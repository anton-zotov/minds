import type { CognitionContext, Intention, Observation, IntentionCandidate, IntentionRevision, IntentionPolicy, MindSnapshot, ActionContext, ActionSelectionContext, ActionExpressionContext } from '../types.js';

// Explicit allowlists keep host controls and replay bookkeeping out of inference.
const event = ({ id, time, source, kind, content }: Observation) => ({ id, time, source, kind, content });
const intention = ({ id, description, status, priority, supportingBeliefIds, evidenceIds }: Intention) =>
  ({ id, description, status, priority, supportingBeliefIds, evidenceIds });
type Context = CognitionContext & { candidate?: IntentionCandidate; activeIntentions?: Intention[]; limits?: IntentionPolicy;
  requestedRevisionIds?: string[]; proposedRevisions?: IntentionRevision[]; otherRevisions?: IntentionRevision[] };
function modelMind(mind: MindSnapshot) {
  const values = (dimensions: typeof mind.mood) => Object.fromEntries(Object.entries(dimensions).map(([name, d]) => [name, { value: d.value }]));
  return { config: { identity: mind.config.identity, goal: mind.config.goal,
      ...(mind.config.intentionPolicy ? { intentionPolicy: { maxActive: mind.config.intentionPolicy.maxActive } } : {}) }, time: mind.time, beliefs: mind.beliefs,
      mood: values(mind.mood), emotions: values(mind.emotions),
      ...(mind.intentions ? { intentions: mind.intentions.map(intention) } : {}) };
}
export function modelContext(context: Context) {
  return {
    mind: modelMind(context.mind),
    observation: event(context.observation),
    memories: context.memories.filter(m => m.id !== context.observation.id).map(m => event(m.observation)),
    ...(context.candidate ? { candidate: context.candidate } : {}),
    // Active commitments are already identified by status in mind.intentions.
    ...(context.limits ? { limits: { maxCandidates: context.limits.maxCandidates, maxActive: context.limits.maxActive } } : {}),
    ...(context.requestedRevisionIds ? { requestedRevisionIds: context.requestedRevisionIds } : {}),
    ...(context.proposedRevisions ? { proposedRevisions: context.proposedRevisions } : {}),
    ...(context.otherRevisions ? { otherRevisions: context.otherRevisions } : {}),
  };
}
export function actionModelContext(context: ActionContext | ActionSelectionContext | ActionExpressionContext) {
  return { mind: modelMind(context.mind), memories: context.memories.map(m => event(m.observation)), opportunity: context.opportunity,
    ...('candidates' in context ? { candidates: context.candidates } : {}),
    ...('candidate' in context ? { candidate: context.candidate } : {}) };
}
