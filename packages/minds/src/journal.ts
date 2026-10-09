import { applyBeliefChanges } from './beliefs.js';
import { applyActionOperation, buildActionRecords } from './actions.js';
import type { ActionPlanOperation, ActionStatusOperation } from './types.js';
import type { CompactMindRecording, JournalOperation, MindRecording, MindSnapshot, CognitionProposal, AppraisalCall, IntentionCycle, RecordedObservation, InspectionRecord } from './types.js';
import { initialSnapshot, buildRecords, contextFor } from './inspection.js';
import { json, object, keys, validateConfig, validateRecordedObservation, isLegacyObservation, validateProposal, number, fail, string } from './validation.js';
import { decay, applyDeltas } from './affect.js';
import { replayAppraisal } from './appraisal.js';
import { completeLegacyIntentions, replayIntentions } from './intentions.js';

export function compactRecords(recording: MindRecording): CompactMindRecording {
  return { schemaVersion: recording.schemaVersion === 8 ? 9 : recording.schemaVersion === 6 ? 7 : 5, config: structuredClone(recording.snapshot.config), operations: compactOperations(recording.records.slice(1)) };
}
export function compactOperations(records: InspectionRecord[]): JournalOperation[] {
  const operations: JournalOperation[] = []; let current: Extract<JournalOperation, { kind: 'observation' }> | undefined;
  for (const record of records) {
    const p = record.payload as unknown as Record<string, any>;
    if (record.type === 'decision' && p.stage === 'action-operation') { operations.push(structuredClone(p.operation)); }
    else if (record.type === 'observation') { current = { kind: 'observation', observation: structuredClone(p) as RecordedObservation }; operations.push(current); }
    else if (record.type === 'decision' && current) {
      if (!p.stage) current.proposal = structuredClone(p.proposal);
      else if (p.stage === 'belief-update' || p.stage === 'emotional-appraisal') {
        (current.appraisalCalls ??= []).push({ stage: p.stage, result: structuredClone(p.result) });
      } else if (p.stage === 'intention-summary') current.intentionCalls = p.cycle.calls.map(({ stage, result }: any) => ({ stage, result: structuredClone(result) }));
    } else if (record.type === 'transition') {
      if (!current && !records.some(r => r.type === 'decision' && (r.payload as any).stage === 'action-operation' && r.revision === record.revision)) operations.push({ kind: 'time', time: record.time });
      current = undefined;
    }
  }
  return operations;
}

// Rebuild diagnostic inputs and derived transitions from authoritative events/results.
// This runs without a provider, so inspecting or restoring never calls an AI.
export function expandJournal(value: unknown): MindRecording {
  json(value); object(value, 'journal'); keys(value, ['schemaVersion', 'config', 'operations'], 'journal');
  if (value.schemaVersion !== 5 && value.schemaVersion !== 7 && value.schemaVersion !== 9) fail('Unsupported journal version');
  validateConfig(value.config); if (!Array.isArray(value.operations)) fail('Journal requires operations');
  let state = initialSnapshot(value.config); const records = buildRecords(null, state, 1); const processedObservationIds: string[] = [];
  const processed = new Set<string>(); const opportunities = new Set<string>();
  for (const entry of value.operations) {
    object(entry, 'journal operation'); const next: MindSnapshot = structuredClone(state);
    if (entry.kind === 'time') {
      if ([6,8].includes(state.schemaVersion)) fail('Self-driven time must be a cognitive event');
      keys(entry, ['kind', 'time'], 'time operation'); number(entry.time, 'time', state.time);
      if (entry.time === state.time) fail('Time-only transition must advance time');
      next.time = entry.time; next.mood = decay(next.mood, next.time - state.time); next.emotions = decay(next.emotions, next.time - state.time); next.revision++;
      records.push(...buildRecords(state, next, records.length + 1));
    } else if (entry.kind === 'observation') {
      keys(entry, ['kind', 'observation', 'proposal', 'appraisalCalls', 'intentionCalls'], 'observation operation');
      validateRecordedObservation(entry.observation, [7,9].includes(value.schemaVersion as number), state); const observation = entry.observation;
      if (processed.has(observation.id)) fail('Duplicate observation in journal'); number(observation.time, 'time', state.time);
      next.time = observation.time; next.mood = decay(next.mood, next.time - state.time); next.emotions = decay(next.emotions, next.time - state.time);
      next.memories.push({ id: observation.id, observation });
      if (isLegacyObservation(observation)) completeLegacyIntentions(next, observation); else next.schemaVersion = state.schemaVersion === 8 ? 8 : 6;
      const context = contextFor(next, observation); let proposal: CognitionProposal | undefined; let appraisalCalls: AppraisalCall[] | undefined; let cycle: IntentionCycle | undefined;
      if (!isLegacyObservation(observation) || observation.processing === 'appraise') {
        if (Object.hasOwn(entry, 'appraisalCalls')) {
          if (Object.hasOwn(entry, 'proposal') || !Array.isArray(entry.appraisalCalls) || entry.appraisalCalls.length !== 2) fail('Invalid appraisal journal');
          for (const call of entry.appraisalCalls) { object(call, 'appraisal call'); keys(call, ['stage', 'result'], 'appraisal call'); }
          appraisalCalls = replayAppraisal(next, observation, entry.appraisalCalls);
        } else {
          validateProposal(entry.proposal, next); proposal = structuredClone(entry.proposal);
          applyBeliefChanges(next, proposal); applyDeltas(next.mood, proposal.moodDeltas); applyDeltas(next.emotions, proposal.emotionDeltas);
        }
        if (next.config.intentionPolicy) {
          if (!Array.isArray(entry.intentionCalls)) fail('Missing intention journal');
          for (const call of entry.intentionCalls) { object(call, 'intention call'); keys(call, ['stage', 'result'], 'intention call'); }
          cycle = replayIntentions(next, observation, { calls: entry.intentionCalls });
        } else if (Object.hasOwn(entry, 'intentionCalls')) fail('Unexpected intention journal');
      } else if (['proposal', 'appraisalCalls', 'intentionCalls'].some(k => Object.hasOwn(entry, k))) fail('Memory-only observation cannot contain decisions');
      next.revision++; records.push(...buildRecords(state, next, records.length + 1, observation, context, proposal, cycle, appraisalCalls));
      processed.add(observation.id); processedObservationIds.push(observation.id);
    } else if (entry.kind === 'action-plan' || entry.kind === 'action-status') {
      if(value.schemaVersion!==9)fail('Actions require journal 9');
      if (entry.kind === 'action-plan') {
        object(entry.opportunity, 'opportunity'); string(entry.opportunity.id, 'opportunity ID');
        if (opportunities.has(entry.opportunity.id)) fail('Duplicate opportunity');
        opportunities.add(entry.opportunity.id);
      }
      applyActionOperation(next,entry as unknown as ActionPlanOperation|ActionStatusOperation);records.push(...buildActionRecords(state,next,records.length+1,entry as unknown as ActionPlanOperation|ActionStatusOperation));
    } else fail('Unknown journal operation');
    state = next;
  }
  return structuredClone({ schemaVersion: state.schemaVersion, snapshot: state, records, processedObservationIds });
}


