import { applyBeliefChanges } from './beliefs.js';
import { compactRecords, expandJournal } from './journal.js';
import type { MindRecording, CognitionProposal, MindSnapshot, IntentionCycle, AppraisalCall } from './types.js';
import { json, object, keys, validateConfig, validateRecordedObservation, isLegacyObservation, validateProposal, number, fail } from './validation.js';
import { initialSnapshot, buildRecords, contextFor } from './inspection.js';
import { decay, applyDeltas } from './affect.js';
import { replayIntentions, completeLegacyIntentions } from './intentions.js';
import { replayAppraisal } from './appraisal.js';
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length}:${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function validateRecording(value: unknown): asserts value is MindRecording {
  json(value); object(value, 'recording'); keys(value, ['schemaVersion', 'snapshot', 'records', 'processedObservationIds'], 'recording');
  if (value.schemaVersion === 8) {
    object(value.snapshot,'snapshot');validateConfig(value.snapshot.config);if(!Array.isArray(value.records)||!value.records.length)fail('Recording requires complete trace');
    const rebuilt=expandJournal(compactRecords(value as unknown as MindRecording));if(canonical(value)!==canonical(rebuilt))fail('Recording trace and snapshot are inconsistent');return;
  }
  if (![1, 2, 3, 4, 6].includes(value.schemaVersion as number)) fail('Unsupported recording schema version');
  object(value.snapshot, 'snapshot'); validateConfig(value.snapshot.config);
  if (!Array.isArray(value.records) || !value.records.length) fail('Recording requires complete trace');
  let state = initialSnapshot(value.snapshot.config); const expected = buildRecords(null, state, 1);
  if (value.schemaVersion !== state.schemaVersion && ![4, 6].includes(value.schemaVersion as number) && !(value.schemaVersion === 3 && state.config.intentionPolicy)) fail('Recording version does not match configuration');
  const processed: string[] = []; let cursor = 1;
  while (cursor < value.records.length) {
    const first = value.records[cursor]; object(first, 'record');
    const next: MindSnapshot = structuredClone(state); let count: number;
    if (first.type === 'observation') {
      validateRecordedObservation(first.payload, value.schemaVersion === 6, state); const observation = first.payload;
      if (processed.includes(observation.id)) fail('Duplicate observation in recording');
      number(observation.time, 'time', state.time);
      next.time = observation.time; next.mood = decay(next.mood, next.time - state.time); next.emotions = decay(next.emotions, next.time - state.time);
      next.memories.push({ id: observation.id, observation });
      if (isLegacyObservation(observation)) completeLegacyIntentions(next, observation); else next.schemaVersion = 6;
      const context = contextFor(next, observation);
      let proposal: CognitionProposal | undefined; let cycle: IntentionCycle | undefined; let appraisalCalls: AppraisalCall[] | undefined;
      if (!isLegacyObservation(observation) || observation.processing === 'appraise') {
        const decision = value.records[cursor + 2]; object(decision, 'decision'); object(decision.payload, 'decision payload');
        if (decision.payload.stage === 'belief-update') {
          const emotional = value.records[cursor + 3]; object(emotional, 'emotional decision');
          appraisalCalls = replayAppraisal(next, observation, [decision.payload, emotional.payload]);
        } else {
        validateProposal(decision.payload.proposal, next); proposal = decision.payload.proposal;
        applyBeliefChanges(next, proposal); applyDeltas(next.mood, proposal.moodDeltas); applyDeltas(next.emotions, proposal.emotionDeltas);
        }
        if (next.config.intentionPolicy) {
          let end = cursor + (appraisalCalls ? 4 : 3);
          while (end < value.records.length && (value.records[end] as Record<string, unknown>)?.type === 'decision') end++;
          const summary = value.records[end - 1]; object(summary, 'intention summary'); object(summary.payload, 'summary payload');
          if (summary.payload.stage !== 'intention-summary') fail('Missing intention summary');
          cycle = replayIntentions(next, observation, summary.payload.cycle);
        }
      }
      next.revision++; const added = buildRecords(state, next, expected.length + 1, observation, context, proposal, cycle, appraisalCalls);
      expected.push(...added); count = added.length; processed.push(observation.id);
    } else if (first.type === 'transition') {
      if (state.schemaVersion === 6) fail('Self-driven time must be a cognitive event');
      number(first.time, 'time', state.time); if (first.time === state.time) fail('Time-only transition must advance time');
      next.time = first.time; next.mood = decay(next.mood, next.time - state.time); next.emotions = decay(next.emotions, next.time - state.time); next.revision++;
      expected.push(...buildRecords(state, next, expected.length + 1)); count = 1;
    } else fail('Invalid recording lifecycle');
    cursor += count; state = next;
  }
  if (canonical(value) !== canonical({ schemaVersion: state.schemaVersion, snapshot: state, records: expected, processedObservationIds: processed })) fail('Recording trace and snapshot are inconsistent');
}

