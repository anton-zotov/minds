import { measuredRecordDurations } from './timing.js';
import { applyBeliefChanges } from './beliefs.js';
import type { ActionContext, ActionGenerationResult, ActionSelectionResult } from './types.js';
import {
  actionContext, validateActionOpportunity, validateActionResult, applyActionOperation, buildActionRecords
}
from './actions.js';
import type {
  ActionPlanOperation, ActionStatusOperation, PlanActionResult
}
from './types.js';
import {
  compactRecords, compactOperations, expandJournal
}
from './journal.js';
import type {
  MindConfig, MindRuntime, CognitionProvider, MindSnapshot, IngestResult, MindRecording, InspectionRecord, CognitionProposal, IntentionCycle, AppraisalCall, Observation
}
from './types.js';
import {
  validateConfig, validateObservation, validateProposal, number, integer, fail, json, object, keys
}
from './validation.js';
import {
  decay, applyDeltas
}
from './affect.js';
import {
  buildRecords, initialSnapshot, contextFor
}
from './inspection.js';
import {
  validateRecording
}
from './persistence.js';
import {
  planIntentions
}
from './intentions.js';
import {
  appraiseSequentially
}
from './appraisal.js';
export function createMind(config: MindConfig, provider: CognitionProvider): MindRuntime {
  validateConfig(config);
  const snapshot = initialSnapshot(config);
  return runtime({
    schemaVersion: snapshot.schemaVersion, snapshot, records: buildRecords(null, snapshot, 1), processedObservationIds: []
  }, provider, true);
}
export function restoreMind(recording: unknown, provider: CognitionProvider): MindRuntime {
  if (recording && typeof recording === 'object' && [5, 7, 9].includes((recording as {
    schemaVersion?: number
  }).schemaVersion!)) return runtime(expandJournal(recording), provider);
  validateRecording(recording);
  return runtime(structuredClone(recording), provider);
}
function runtime(recording: MindRecording, provider: CognitionProvider, fresh = false): MindRuntime {
  if (!provider || typeof provider.appraise !== 'function') fail('Provider must implement appraise');
  if (provider.stages && (typeof provider.stages.updateBeliefs !== 'function' || typeof provider.stages.appraiseEmotions !== 'function')) fail('Staged provider must implement both appraisal operations');
  if (recording.snapshot.config.intentionPolicy && (!provider.intentions || ['reconsider', 'generate', 'evaluate', 'sufficient'].some(name => typeof provider.intentions![name as keyof typeof provider.intentions] !== 'function'))) fail('Planning provider must implement all intention operations');
  // Only the currently pending opportunity is retained, without inspection traces.
  let pending: { revision: number; context: ActionContext; generation?: ActionGenerationResult; selection?: ActionSelectionResult } | undefined;
  let state = recording.snapshot;
  const journal = compactRecords(recording);
  let recordCount = recording.records.length;
  const recordDurations: Record<string, number> = {};
  if (fresh) for (const r of recording.records) { const ms = measuredRecordDurations.get(r); if (ms !== undefined) recordDurations[r.id] = ms; }
  const processed = new Set(recording.processedObservationIds);
  const listeners = new Set<(records: InspectionRecord[]) => void>();
  let queue = Promise.resolve();
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation);
    queue = result.then(() => {
    }, () => {
    });
    return result;
  }
  function atTime(time: number): MindSnapshot {
    number(time, 'time', 0);
    if (time < state.time) fail('Simulation time cannot move backward');
    const next = structuredClone(state);
    next.time = time;
    next.mood = decay(next.mood, time - state.time);
    next.emotions = decay(next.emotions, time - state.time);
    return next;
  }
  function result(duplicate = false, added: InspectionRecord[] = []): IngestResult {
    return {
      duplicate, snapshot: structuredClone(state), records: structuredClone(added)
    };
  }
  function commit(next: MindSnapshot, added: InspectionRecord[]): IngestResult {
    for (const r of added) { const ms = measuredRecordDurations.get(r); if (ms !== undefined) recordDurations[r.id] = ms; }
    journal.operations.push(...compactOperations(added));
    if (next.schemaVersion === 8) journal.schemaVersion = 9;
    else if (next.schemaVersion === 6) journal.schemaVersion = 7;
    pending = undefined;
    state = next;
    recordCount += added.length;
    const committed = result(false, added);
    for (const listener of [...listeners]) {
      try {
        const returned: unknown = listener(structuredClone(added));
        if (returned !== undefined) void Promise.resolve(returned).catch(() => {
        });
      }
      catch {
        /* Diagnostics cannot roll back cognition. */
      }
    }
    return committed;
  }
  async function processObservation(observation: Observation): Promise<IngestResult> {
    if (processed.has(observation.id)) return result(true);
    const receivedAt = performance.now();
    const next = atTime(observation.time);
    next.schemaVersion = state.schemaVersion === 8 ? 8 : 6;
    const receivedDuration = performance.now() - receivedAt;
    const memoryStarted = performance.now();
    next.memories.push({
      id: observation.id, observation
    });
    const memoryDuration = performance.now() - memoryStarted;
    const context = contextFor(next, observation);
    let proposed: CognitionProposal | undefined;
    let cycle: IntentionCycle | undefined;
    let appraisalCalls: AppraisalCall[] | undefined;
    if (provider.stages) appraisalCalls = await appraiseSequentially(next, observation, provider.stages);
    else {
      const output = await provider.appraise(structuredClone(context));
      validateProposal(output, next);
      proposed = structuredClone(output);
      applyBeliefChanges(next, proposed);
      applyDeltas(next.mood, proposed.moodDeltas);
      applyDeltas(next.emotions, proposed.emotionDeltas);
    }
    if (next.config.intentionPolicy) cycle = await planIntentions(next, observation, provider.intentions!);
    const transitionStarted = performance.now();
    next.revision++;
    integer(next.revision, 'revision');
    const added = buildRecords(state, next, recordCount + 1, observation, context, proposed, cycle, appraisalCalls);
    processed.add(observation.id);
    const committed = commit(next, added);
    for (const r of added) { if (r.type === 'observation') recordDurations[r.id] = receivedDuration; if (r.type === 'memory') recordDurations[r.id] = memoryDuration; if (r.type === 'transition') recordDurations[r.id] = performance.now() - transitionStarted; }
    return committed;
  }
  function status(entry:ActionStatusOperation):IngestResult {
    const action=state.actions?.find(a=>a.id===entry.actionId);
    if(!action)fail('Unknown action');
    if(entry.status==='submitted' && action.status!=='proposed')return result(true);
    if(action.status===entry.status&&action.reason===entry.reason)return result(true);
    const started = performance.now();
    const next=structuredClone(state);
    applyActionOperation(next,entry);
    const committed = commit(next,buildActionRecords(state,next,recordCount+1,entry));
    for (const r of committed.records) recordDurations[r.id] = performance.now() - started;
    return committed;
  }
  return {
    planAction: async input => {
      json(input);
      const opportunity = structuredClone(input);
      return enqueue(async () => {
        const old = journal.operations.find(e => e.kind === 'action-plan' && e.opportunity.id === opportunity.id);
        if (old) return {
          ...result(true), action: structuredClone(state.actions?.find(a => a.opportunityId === opportunity.id) ?? null)
        };
        validateActionOpportunity(opportunity, state.time);
        if (!provider.actions || ['generate','select','express'].some(k => typeof provider.actions![k as keyof typeof provider.actions] !== 'function')) fail('Provider must implement action operations');
        if (!pending || pending.context.opportunity.id !== opportunity.id || pending.revision !== state.revision) {
          pending = { revision: state.revision, context: actionContext(state, opportunity) };
        }
        const context = pending.context;
        if (!pending.generation) {
          const generated = await provider.actions.generate(structuredClone(context));
          validateActionResult('action-generation', generated, context);
          pending.generation = structuredClone(generated);
        }
        const generation = pending.generation;
        if (!pending.selection) {
          const selected = await provider.actions.select(structuredClone({ ...context, candidates: generation.candidates }));
          validateActionResult('action-selection', selected, { ...context, candidates: generation.candidates });
          pending.selection = structuredClone(selected);
        }
        const selection = pending.selection;
        const entry:ActionPlanOperation={
          kind:'action-plan',opportunity:structuredClone(context.opportunity),generation:structuredClone(generation),selection:structuredClone(selection)
        };
        const candidate=generation.candidates.find(c=>c.id===selection.candidateId);
        if(candidate&&context.opportunity.capabilities.find(c=>c.id===candidate.capabilityId)!.expression==='speech'){
          entry.expression=await provider.actions.express(structuredClone({
            ...context,candidate
          }));
          validateActionResult('action-expression',entry.expression,{
            ...context,candidate
          });
          entry.expression=structuredClone(entry.expression);
        }
        const started = performance.now();
        const next=structuredClone(state);
        const action=applyActionOperation(next,entry);
        const committed=commit(next,buildActionRecords(state,next,recordCount+1,entry));
        for (const r of committed.records) if (r.type === 'transition' || (r.payload as any).stage === 'action-operation') recordDurations[r.id] = performance.now() - started;
        return {
          ...committed,action:structuredClone(action)
        } as PlanActionResult;
      });
    },
    submitAction: async actionId => enqueue(async()=>status({
      kind:'action-status',actionId,status:'submitted',reason:null
    })),
    resolveAction: async input => {
      json(input);
      object(input,'receipt');
      keys(input,['actionId','status','reason'],'receipt');
      if(!['executed','rejected'].includes(input.status))fail('Invalid receipt status');
      const receipt=structuredClone(input);
      return enqueue(async()=>status({
        kind:'action-status',...receipt
      }));
    },
    getSnapshot: () => structuredClone(state),
    getRecordCount: () => recordCount,
    getRecordDurations: () => ({ ...recordDurations }),
    ingest: async input => {
      validateObservation(input);
      const observation = structuredClone(input);
      return enqueue(() => processObservation(observation));
    },
    advanceTime: async time => enqueue(async () => {
      number(time, 'time', state.time);
      if (time === state.time) return result();
      const base = JSON.stringify(['elapsed-time', state.config.mindId, state.revision + 1, time]);
      let id = base;
      let suffix = 0;
      while (processed.has(id)) id = `${base}:${++suffix}`;
      return processObservation({
        id, time, source: 'clock', kind: 'elapsed-time', content: `${time - state.time} ms have elapsed.`
      });
    }),
    getRecords: (afterSequence = 0) => {
      integer(afterSequence, 'afterSequence');
      return afterSequence >= recordCount ? [] : expandJournal(journal).records.filter(record => record.sequence > afterSequence);
    },
    subscribe: listener => {
      if (typeof listener !== 'function') fail('Subscriber must be a function');
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    exportRecording: () => expandJournal(journal),
    exportCompactRecording: () => structuredClone(journal),
  };
}

