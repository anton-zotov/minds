import { measuredRecordDurations } from './timing.js';
import type { MindSnapshot, InspectionRecord, CognitionContext, CognitionProposal, Observation, JsonValue, IntentionCycle, AppraisalCall, EmotionalAppraisalResult } from './types.js';
import { integer } from './validation.js';
export function initialSnapshot(config: MindSnapshot['config']): MindSnapshot {
  return structuredClone({ schemaVersion: config.intentionPolicy ? 2 : 1, revision: 0, config, time: config.time,
    beliefs: config.beliefs, mood: config.mood, emotions: config.emotions, memories: [], ...(config.intentionPolicy ? { intentions: [] } : {}) });
}
export function contextFor(next: MindSnapshot, observation: Observation): CognitionContext {
  const memories = next.memories.slice(-20);
  return structuredClone({ mind: { ...next, memories }, observation, memories });
}
export function transitionPayload(before: MindSnapshot, after: MindSnapshot, proposal?: Pick<CognitionProposal, 'moodDeltas' | 'emotionDeltas'>): JsonValue {
  const changes = (layer: 'mood' | 'emotions') => Object.entries(after[layer]).map(([name, value]) => ({
    name, before: before[layer][name]!.value, after: value.value, delta: value.value - before[layer][name]!.value,
  })).filter(change => change.delta !== 0);
  return structuredClone({ before, after, affectChanges: { mood: changes('mood'), emotions: changes('emotions') },
    requestedDeltas: { mood: proposal?.moodDeltas ?? {}, emotions: proposal?.emotionDeltas ?? {} } }) as unknown as JsonValue;
}
export function buildRecords(before: MindSnapshot | null, after: MindSnapshot, startSequence: number,
  observation?: Observation, context?: CognitionContext, proposal?: CognitionProposal, cycle?: IntentionCycle, appraisalCalls?: AppraisalCall[]): InspectionRecord[] {
  const records: InspectionRecord[] = [];
  const add = (type: InspectionRecord['type'], payload: unknown, causeIds: string[] = []) => {
    const started = performance.now();
    const sequence = startSequence + records.length; integer(sequence, 'record sequence', 1);
    const { runId, mindId } = after.config;
    const record: InspectionRecord = { schemaVersion: after.schemaVersion, id: JSON.stringify([runId, mindId, sequence]), runId, mindId,
      sequence, revision: after.revision, time: after.time, type, observationId: observation?.id ?? null,
      causeIds, payload: structuredClone(payload) as JsonValue };
    records.push(record); measuredRecordDurations.set(record, performance.now() - started); return record.id;
  };
  if (!before) { add('initialized', after); return records; }
  let cause: string | undefined;
  if (observation) {
    cause = add('observation', observation);
    cause = add('memory', { id: observation.id, observation }, [cause]);
    if (proposal) cause = add('decision', { context, retrievedMemoryIds: context!.memories.map(memory => memory.id), proposal }, [cause]);
    if (appraisalCalls) for (const call of appraisalCalls) cause = add('decision', call, [cause]);
    if (cycle) {
      for (const call of cycle.calls) cause = add('decision', call, [cause]);
      cause = add('decision', { stage: 'intention-summary', cycle }, [cause]);
    }
  }
  add('transition', transitionPayload(before, after, proposal ?? appraisalCalls?.[1]?.result as EmotionalAppraisalResult | undefined), cause ? [cause] : []); return records;
}
