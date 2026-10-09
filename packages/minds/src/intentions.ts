import type { MindSnapshot, Observation, LegacyObservation, Intention, IntentionProvider, IntentionCall, IntentionCycle, IntentionStage, CognitionContext, IntentionCandidate, ReconsiderationResult, GenerationResult, IntentionEvaluation, SufficiencyResult, IntentionRevision } from './types.js';
import { contextFor } from './inspection.js';
import { json, object, keys, string, strings, number, fail, validateMetadata } from './validation.js';

export const retainedIntention = (intention: Intention) => intention.status === 'active' || intention.status === 'suspended';
// Historical replay only; new observations cannot carry completion commands.
export function completeLegacyIntentions(state: MindSnapshot, observation: LegacyObservation): void {
  if (!observation.intentionCompletions) return;
  for (const id of observation.intentionCompletions) {
    const intention = state.intentions?.find(i => i.id === id);
    if (!intention || !retainedIntention(intention)) fail('Unknown or retired intention completion');
  }
  if (state.schemaVersion !== 4) state.schemaVersion = 3;
  for (const id of observation.intentionCompletions) {
    const intention = state.intentions!.find(i => i.id === id)!;
    intention.status = 'completed'; intention.reconsideredAt = state.time; intention.evidenceIds = [observation.id];
  }
}

function boolean(value: unknown, label: string): asserts value is boolean { if (typeof value !== 'boolean') fail(`${label} must be a boolean`); }
function references(value: unknown, state: MindSnapshot): asserts value is string[] {
  strings(value, 'supporting belief IDs'); if (value.some(id => !state.beliefs.some(b => b.id === id))) fail('Unknown supporting belief');
}
export function validateIntentionResult(stage: IntentionStage, value: unknown, state: MindSnapshot, observation: Observation): void {
  json(value); object(value, 'intention result'); validateMetadata(value.metadata);
  if (stage === 'intention-generation') {
    keys(value, ['candidates', 'metadata'], 'generation');
    if (!Array.isArray(value.candidates) || value.candidates.length > state.config.intentionPolicy!.maxCandidates) fail('Candidate pool exceeds limit');
    const ids = new Set<string>();
    for (const c of value.candidates) {
      object(c, 'candidate'); keys(c, ['id', 'description', 'priority', 'supportingBeliefIds'], 'candidate');
      string(c.id, 'candidate ID'); string(c.description, 'description'); number(c.priority, 'priority', 0, 1); references(c.supportingBeliefIds, state);
      if (ids.has(c.id)) fail('Duplicate candidate ID'); ids.add(c.id);
    }
  } else if (stage === 'intention-evaluation') {
    keys(value, ['accept', 'scores', 'metadata'], 'evaluation'); boolean(value.accept, 'accept'); object(value.scores, 'scores');
    const criteria = ['goalAlignment', 'feasibility', 'emotionalCompatibility', 'novelty', 'compatibility']; keys(value.scores, criteria, 'scores');
    for (const name of criteria) number(value.scores[name], name, 0, 1);
  } else if (stage === 'intention-sufficiency') {
    keys(value, ['sufficient', 'metadata'], 'sufficiency'); boolean(value.sufficient, 'sufficient');
  } else {
    keys(value, ['revisions', 'generateMore', 'metadata'], 'reconsideration'); boolean(value.generateMore, 'generateMore');
    if (!Array.isArray(value.revisions) || value.revisions.length > state.intentions!.length) fail('Invalid revisions');
    const ids = new Set<string>();
    for (const r of value.revisions) {
      object(r, 'revision'); keys(r, ['intentionId', 'action', 'description', 'priority', 'supportingBeliefIds', 'evidenceIds'], 'revision');
      string(r.intentionId, 'intention ID'); const intention = state.intentions!.find(i => i.id === r.intentionId);
      if (!intention || !retainedIntention(intention) || ids.has(r.intentionId)) fail('Unknown, retired or repeated intention'); ids.add(r.intentionId);
      if (!['keep', 'reprioritize', 'revise', 'suspend', 'abandon', 'reactivate', ...([6,8].includes(state.schemaVersion) ? ['complete'] : [])].includes(r.action as string)) fail('Invalid revision action');
      strings(r.evidenceIds, 'revision evidence');
      if (r.evidenceIds.some(id => !state.memories.some(m => m.id === id))) fail('Unknown revision evidence');
      if (r.action !== 'keep' && !r.evidenceIds.includes(observation.id)) fail('Revision requires triggering evidence');
      const allowed = r.action === 'revise' ? ['description', 'priority', 'supportingBeliefIds'] : r.action === 'reprioritize' ? ['priority'] : [];
      for (const field of ['description', 'priority', 'supportingBeliefIds']) if (r[field] !== undefined && !allowed.includes(field)) fail('Unsupported revision field for action');
      if (r.action === 'revise') string(r.description, 'revision description');
      if (r.action === 'reprioritize' || r.priority !== undefined) number(r.priority, 'priority', 0, 1);
      if (r.supportingBeliefIds !== undefined) references(r.supportingBeliefIds, state);
      if (r.action === 'reactivate' && intention.status !== 'suspended') fail('Only suspended intentions can reactivate');
    }
  }
}
function revise(state: MindSnapshot, revision: IntentionRevision): void {
  if (revision.action === 'keep') return;
  const i = state.intentions!.find(i => i.id === revision.intentionId)!;
  if (revision.description !== undefined) i.description = revision.description;
  if (revision.priority !== undefined) i.priority = revision.priority;
  if (revision.supportingBeliefIds !== undefined) i.supportingBeliefIds = revision.supportingBeliefIds;
  if (revision.action === 'suspend') i.status = 'suspended';
  if (revision.action === 'abandon') i.status = 'abandoned';
  if (revision.action === 'complete') i.status = 'completed';
  if (revision.action === 'reactivate') i.status = 'active';
  i.reconsideredAt = state.time; i.evidenceIds = revision.evidenceIds;
}
const normalized = (description: string) => description.trim().replace(/\s+/g, ' ').toLowerCase();
function shuffled(pool: IntentionCandidate[], seed: number): IntentionCandidate[] {
  const result = [...pool]; let random = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((random / 0x100000000) * (i + 1)); [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
type Request = { stage: IntentionStage; input: IntentionCall['input'] };
// Both live execution and recording validation drive this exact deterministic machine.
export function* intentionMachine(state: MindSnapshot, observation: Observation): Generator<Request, IntentionCycle, unknown> {
  const limits = state.config.intentionPolicy!;
  const cycle: IntentionCycle = { calls: [], seed: limits.seed, candidateOrder: [], evaluations: [], acceptedIntentionIds: [], stoppingReason: 'pool-exhausted' };
  const active = () => state.intentions!.filter(i => i.status === 'active');
  const context = () => contextFor(state, observation);
  function* call(stage: IntentionStage, input: CognitionContext): Generator<Request, IntentionCall['result'], unknown> {
    const result = yield { stage, input: structuredClone(input) };
    validateIntentionResult(stage, result, state, observation);
    const detached = structuredClone(result) as IntentionCall['result']; cycle.calls.push({ stage, input: structuredClone(input), result: detached }); return detached;
  }
  if (state.intentions!.some(retainedIntention)) {
    const result = (yield* call('intention-reconsideration', context())) as ReconsiderationResult;
    for (const revision of result.revisions) revise(state, revision);
    const retainedDescriptions = state.intentions!.filter(retainedIntention).map(i => normalized(i.description));
    if (new Set(retainedDescriptions).size !== retainedDescriptions.length) fail('Duplicate retained intention after reconsideration');
    if (active().length > limits.maxActive) fail('Reconsideration exceeds active intention limit');
    if (!result.generateMore && ([6,8].includes(state.schemaVersion) || active().length)) { cycle.stoppingReason = 'commitment-preserved'; return cycle; }
  }
  if (active().length >= limits.maxActive) { cycle.stoppingReason = 'active-limit'; return cycle; }
  const generated = (yield* call('intention-generation', { ...context(), limits } as CognitionContext)) as GenerationResult;
  const ordered = shuffled(generated.candidates, limits.seed); cycle.candidateOrder = ordered.map(c => c.id);
  const seen = new Set(state.intentions!.filter(retainedIntention).map(i => normalized(i.description)));
  let evaluated = 0;
  for (const candidate of ordered) {
    if (active().length >= limits.maxActive) { cycle.stoppingReason = 'active-limit'; return cycle; }
    if (evaluated >= limits.maxEvaluations) { cycle.stoppingReason = 'evaluation-limit'; return cycle; }
    const description = normalized(candidate.description);
    if (seen.has(description)) {
      cycle.evaluations.push({ candidateId: candidate.id, accepted: false, reason: 'duplicate', activeIntentionIds: active().map(i => i.id) }); continue;
    }
    seen.add(description); evaluated++;
    const result = (yield* call('intention-evaluation', { ...context(), candidate, activeIntentions: active() } as CognitionContext)) as IntentionEvaluation;
    let adoptedId: string | undefined;
    if (result.accept) {
      adoptedId = JSON.stringify([state.config.runId, state.config.mindId, 'intention', observation.id, candidate.id]);
      state.intentions!.push({ id: adoptedId, description: candidate.description, priority: candidate.priority, supportingBeliefIds: candidate.supportingBeliefIds,
        status: 'active', goal: state.config.goal, createdAt: state.time, reconsideredAt: state.time, originObservationId: observation.id, evidenceIds: [observation.id] });
      cycle.acceptedIntentionIds.push(adoptedId);
    }
    cycle.evaluations.push({ candidateId: candidate.id, accepted: result.accept, reason: result.accept ? 'accepted' : 'provider-rejected', activeIntentionIds: active().map(i => i.id) });
    if (adoptedId) {
      const sufficiency = (yield* call('intention-sufficiency', { ...context(), activeIntentions: active() } as CognitionContext)) as SufficiencyResult;
      if (sufficiency.sufficient) { cycle.stoppingReason = 'sufficient'; return cycle; }
    }
  }
  return cycle;
}
const methods = { 'intention-reconsideration': 'reconsider', 'intention-generation': 'generate', 'intention-evaluation': 'evaluate', 'intention-sufficiency': 'sufficient' } as const;
export async function planIntentions(state: MindSnapshot, observation: Observation, provider: IntentionProvider): Promise<IntentionCycle> {
  const machine = intentionMachine(state, observation); let step = machine.next();
  while (!step.done) {
    const method = provider[methods[step.value.stage]] as (input: IntentionCall['input']) => Promise<unknown>;
    const output = await method.call(provider, structuredClone(step.value.input)); step = machine.next(output);
  }
  return step.value;
}
export function replayIntentions(state: MindSnapshot, observation: Observation, recorded: unknown): IntentionCycle {
  json(recorded); object(recorded, 'intention cycle'); if (!Array.isArray(recorded.calls)) fail('Missing intention calls');
  const machine = intentionMachine(state, observation); let step = machine.next(), cursor = 0;
  while (!step.done) {
    const call = recorded.calls[cursor++]; object(call, 'recorded intention call');
    if (call.stage !== step.value.stage) fail('Invalid intention stage order');
    step = machine.next(call.result);
  }
  if (cursor !== recorded.calls.length) fail('Unexpected intention calls'); return step.value;
}

