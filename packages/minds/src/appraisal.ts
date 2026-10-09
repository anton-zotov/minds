import type { AppraisalCall, AppraisalStages, BeliefUpdateResult, EmotionalAppraisalResult, MindSnapshot, Observation } from './types.js';
import { json, object, keys, validateProposal, fail } from './validation.js';
import { contextFor } from './inspection.js';
import { applyDeltas } from './affect.js';
import { applyBeliefChanges } from './beliefs.js';

export function applyAppraisalResult(state: MindSnapshot, stage: AppraisalCall['stage'], result: unknown): void {
  json(result); object(result, 'appraisal result');
  if (stage === 'belief-update') {
    keys(result, ['beliefUpdates', 'beliefRetirements', 'metadata'], 'belief update');
    validateProposal({ ...result, moodDeltas: {}, emotionDeltas: {} }, state);
    applyBeliefChanges(state,result as unknown as BeliefUpdateResult);
  } else {
    keys(result, ['moodDeltas', 'emotionDeltas', 'metadata'], 'emotional appraisal');
    validateProposal({ ...result, beliefUpdates: [] }, state);
    applyDeltas(state.mood, (result as unknown as EmotionalAppraisalResult).moodDeltas);
    applyDeltas(state.emotions, (result as unknown as EmotionalAppraisalResult).emotionDeltas);
  }
}
export async function appraiseSequentially(state: MindSnapshot, observation: Observation, provider: AppraisalStages): Promise<AppraisalCall[]> {
  if (![6, 8].includes(state.schemaVersion)) state.schemaVersion = 4; const calls: AppraisalCall[] = [];
  for (const [stage, operation] of [['belief-update', 'updateBeliefs'], ['emotional-appraisal', 'appraiseEmotions']] as const) {
    const input = contextFor(state, observation); const result = await provider[operation](structuredClone(input));
    applyAppraisalResult(state, stage, result); calls.push({ stage, input, result: structuredClone(result) });
  }
  return calls;
}
export function replayAppraisal(state: MindSnapshot, observation: Observation, recorded: unknown[]): AppraisalCall[] {
  if (![6, 8].includes(state.schemaVersion)) state.schemaVersion = 4; const calls: AppraisalCall[] = [];
  for (const [index, stage] of (['belief-update', 'emotional-appraisal'] as const).entries()) {
    const call = recorded[index]; object(call, 'appraisal call'); keys(call, ['stage', 'input', 'result'], 'appraisal call');
    if (call.stage !== stage) fail('Appraisal stages are out of order');
    const input = contextFor(state, observation); applyAppraisalResult(state, stage, call.result);
    calls.push({ stage, input, result: structuredClone(call.result) as AppraisalCall['result'] });
  }
  return calls;
}
