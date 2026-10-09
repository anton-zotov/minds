import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMind, restoreMind } from '../src/index.js';
import { config, observation, proposal, passive } from './helpers.js';

const metadata = () => ({ provider: 'planning-fixture', model: null, explanation: 'Test judgment', parameters: {} });
const candidate = (id: string, description = `Strategy ${id}`) => ({ id, description, priority: 0.7, supportingBeliefIds: [] });
const judgment = (accept = true) => ({ accept, scores: { goalAlignment: 0.9, feasibility: 0.8, emotionalCompatibility: 0.7, novelty: 0.8, compatibility: 0.9 }, metadata: metadata() });
function planning(overrides: Record<string, unknown> = {}): any {
  return { reconsider: async () => ({ revisions: [], generateMore: false, metadata: metadata() }),
    generate: async () => ({ candidates: [candidate('a'), candidate('b')], metadata: metadata() }),
    evaluate: async () => judgment(), sufficient: async () => ({ sufficient: true, metadata: metadata() }), ...overrides };
}
function plannedConfig(overrides = {}): any { return { ...config(), intentionPolicy: { maxCandidates: 6, maxEvaluations: 6, maxActive: 3, seed: 42, ...overrides } }; }
function mindWith(operations = planning(), policy = {}) { return createMind(plannedConfig(policy), { ...passive, intentions: operations } as any); }
const intentions = (mind: ReturnType<typeof createMind>): any[] => (mind.getSnapshot() as any).intentions;
const summary = (mind: ReturnType<typeof createMind>): any => mind.getRecords().filter(r => (r.payload as any)?.stage === 'intention-summary').at(-1)!.payload;

test('first appraisal adopts a runtime-owned intention without changing the assigned goal', async () => {
  const mind = mindWith(); await mind.ingest(observation());
  const selected = intentions(mind); assert.equal(selected.length, 1);
  assert.equal(selected[0].goal, config().goal); assert.equal(mind.getSnapshot().config.goal, config().goal);
  assert.equal(selected[0].status, 'active'); assert.equal(selected[0].originObservationId, 'event-1');
  assert.equal(selected[0].createdAt, 0); assert.notEqual(selected[0].id, 'a');
  assert.equal(mind.exportRecording().schemaVersion, 6);
  const records = mind.getRecords();
  assert.deepEqual(records.at(-1)!.causeIds, [records.at(-2)!.id]);
  assert.equal(summary(mind).cycle.stoppingReason, 'sufficient');
});

test('ordinary and elapsed-time events reconsider commitments without generating', async () => {
  let generations = 0, reconsiderations = 0;
  const mind = mindWith(planning({ generate: async () => { generations++; return { candidates: [candidate('a')], metadata: metadata() }; },
    reconsider: async () => { reconsiderations++; return { revisions: [], generateMore: false, metadata: metadata() }; } }));
  await mind.ingest(observation()); const committed = intentions(mind);
  await mind.ingest(observation('ordinary', 100)); assert.deepEqual(intentions(mind), committed);
  assert.equal(summary(mind).cycle.stoppingReason, 'commitment-preserved');
  await mind.ingest(observation('trivial', 200)); await mind.advanceTime(300);
  assert.equal(generations, 1); assert.equal(reconsiderations, 3); assert.deepEqual(intentions(mind), committed);
  assert.equal((await mind.ingest(observation())).duplicate, true);
});

test('reconsideration changes a strategy with provenance and keeps its stable identity and goal', async () => {
  const mind = mindWith(planning({ reconsider: async (c: any) => ({ revisions: [{ intentionId: c.mind.intentions[0].id, action: 'revise',
    description: 'Monitor the renewed access agreement', priority: 0.8, supportingBeliefIds: [], evidenceIds: [c.observation.id] }], generateMore: false, metadata: metadata() }) }));
  await mind.ingest(observation()); const first = intentions(mind)[0];
  await mind.ingest(observation('reopened', 100)); const revised = intentions(mind)[0];
  assert.equal(revised.id, first.id); assert.equal(revised.createdAt, 0); assert.equal(revised.reconsideredAt, 100);
  assert.equal(revised.description, 'Monitor the renewed access agreement'); assert.deepEqual(revised.evidenceIds, ['reopened']);
  assert.equal(revised.goal, first.goal);
});

test('planning sees updated subjective beliefs, affect and identity while retained memory stays bounded', async () => {
  const provider: any = { appraise: async (c: any) => ({ ...proposal(), beliefUpdates: [{ id: 'known', statement: 'Access is blocked', confidence: 0.9, evidenceIds: [c.observation.id] }], emotionDeltas: { anger: 0.8 } }),
    intentions: planning({ evaluate: async (c: any) => {
      assert.equal(c.mind.emotions.anger.value, 0.8); assert.equal(c.mind.beliefs[0].id, 'known');
      assert.equal(c.mind.config.identity.description, config().identity.description);
      assert.ok(c.memories.length <= 20); assert.equal(c.mind.memories.length, c.memories.length);
      return judgment(c.mind.emotions.anger.value > 0.5);
    } }) };
  const mind = createMind(plannedConfig(), provider); await mind.ingest(observation()); assert.equal(intentions(mind).length, 1);
});

test('seeded order, duplicates and limits remain inspectable and bounded', async () => {
  const pool = [candidate('a', '  Negotiate Access '), candidate('b', 'negotiate access'), candidate('c', 'Inspect gate')];
  const provider = planning({ generate: async () => ({ candidates: pool, metadata: metadata() }), sufficient: async () => ({ sufficient: false, metadata: metadata() }) });
  const mind = mindWith(provider); const other = mindWith(provider); await mind.ingest(observation()); await other.ingest(observation());
  assert.equal(intentions(mind).length, 2); assert.deepEqual(summary(mind).cycle.candidateOrder, summary(other).cycle.candidateOrder);
  assert.equal(summary(mind).cycle.evaluations.filter((e: any) => e.reason === 'duplicate').length, 1);
  assert.equal(summary(mind).cycle.stoppingReason, 'pool-exhausted');
  const limited = mindWith(provider, { maxEvaluations: 1 }); await limited.ingest(observation());
  assert.equal(summary(limited).cycle.stoppingReason, 'evaluation-limit'); assert.equal(intentions(limited).length, 1);
  const full = mindWith(provider, { maxActive: 1 }); await full.ingest(observation());
  assert.equal(summary(full).cycle.stoppingReason, 'active-limit'); assert.equal(intentions(full).length, 1);
});

test('malformed planning or a late provider failure rolls back appraisal, memory and observation ID', async () => {
  let fail = true;
  const mind = mindWith(planning({ sufficient: async () => { if (fail) throw new Error('late failure'); return { sufficient: true, metadata: metadata() }; } }));
  const before = mind.exportRecording(); await assert.rejects(mind.ingest(observation()), /late failure/);
  assert.deepEqual(mind.exportRecording(), before); fail = false; await mind.ingest(observation()); assert.equal(intentions(mind).length, 1);
  for (const operations of [
    planning({ generate: async () => ({ candidates: [candidate('a'), candidate('a')], metadata: metadata() }) }),
    planning({ generate: async () => ({ candidates: [{ ...candidate('a'), supportingBeliefIds: ['hidden'] }], metadata: metadata() }) }),
    planning({ generate: async () => ({ candidates: Array.from({ length: 7 }, (_, n) => candidate(String(n))), metadata: metadata() }) }),
    planning({ evaluate: async () => ({ ...judgment(), accept: 'yes' }) }),
  ]) {
    const invalid = mindWith(operations); await assert.rejects(invalid.ingest(observation())); assert.equal(invalid.getSnapshot().revision, 0);
  }
});

test('revision refuses unknown IDs, completion without triggering evidence and changes without triggering evidence', async () => {
  for (const revision of [
    { intentionId: 'unknown', action: 'abandon', evidenceIds: ['next'] },
    { action: 'complete', evidenceIds: ['event-1'] }, { action: 'suspend', evidenceIds: [] },
  ]) {
    const operations = planning({ reconsider: async (c: any) => ({ revisions: [{ intentionId: c.mind.intentions[0].id, ...revision }], generateMore: false, metadata: metadata() }) });
    const mind = mindWith(operations); await mind.ingest(observation()); const before = mind.exportRecording();
    await assert.rejects(mind.ingest(observation('next', 100))); assert.deepEqual(mind.exportRecording(), before);
  }
});

test('restoration replays all planning without inference, preserves commitment, and rejects trace tampering', async () => {
  const mind = mindWith(); await mind.ingest(observation()); await mind.ingest(observation('ordinary', 100));
  const recording = JSON.parse(JSON.stringify(mind.exportRecording()));
  const restored = restoreMind(recording, { ...passive, intentions: planning({ generate: async () => { throw new Error('must not generate on restore'); } }) } as any);
  assert.deepEqual(restored.getSnapshot(), mind.getSnapshot());
  await restored.ingest(observation('next', 200)); assert.deepEqual(intentions(restored), intentions(mind));
  for (const corrupt of [
    (r: any) => { r.snapshot.intentions[0].description = 'invented'; },
    (r: any) => { r.records.find((x: any) => x.payload?.stage === 'intention-summary').payload.cycle.candidateOrder.reverse(); },
    (r: any) => { r.records.find((x: any) => x.payload?.stage === 'intention-evaluation').payload.input.mind.config.goal = 'foreign'; },
    (r: any) => { r.records.splice(4, 1); },
  ]) { const changed = structuredClone(recording); corrupt(changed); assert.throws(() => restoreMind(changed, { ...passive, intentions: planning() } as any)); }
  const legacy = createMind(config(), passive); await legacy.ingest(observation());
  assert.equal(legacy.exportRecording().schemaVersion, 6); assert.deepEqual(restoreMind(legacy.exportRecording(), passive).getSnapshot(), legacy.getSnapshot());
});

test('planning contexts are detached and serialized so later observations see committed intentions', async () => {
  const mind = mindWith(planning({ evaluate: async (c: any) => { c.mind.config.goal = 'mutated'; c.candidate.description = 'mutated'; return judgment(); } }));
  await Promise.all([mind.ingest(observation()), mind.ingest(observation('second', 100))]);
  assert.equal(mind.getSnapshot().revision, 2); assert.equal(intentions(mind).length, 1);
  assert.equal(intentions(mind)[0].goal, config().goal); assert.notEqual(intentions(mind)[0].description, 'mutated');
});

test('reconsideration cannot bypass duplicate safeguards by revising one retained strategy into another', async () => {
  const mind = mindWith(planning({ sufficient: async () => ({ sufficient: false, metadata: metadata() }),
    reconsider: async (c: any) => ({ revisions: [{ intentionId: c.mind.intentions[0].id, action: 'revise',
      description: `  ${c.mind.intentions[1].description.toUpperCase()}  `, evidenceIds: [c.observation.id] }], generateMore: false, metadata: metadata() }) }));
  await mind.ingest(observation()); const before = mind.exportRecording();
  await assert.rejects(mind.ingest(observation('next', 100)), /Duplicate retained intention/); assert.deepEqual(mind.exportRecording(), before);
});
