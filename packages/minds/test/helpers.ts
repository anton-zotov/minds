import type { MindConfig, Observation, CognitionProposal, CognitionProvider } from '../src/index.js';
export function config(id = 'alice'): MindConfig {
  return { runId: 'run-1', mindId: id, identity: { name: id, description: 'A cautious negotiator' },
    goal: 'Protect public access', time: 0, beliefs: [], mood: { calm: { baseline: 0.5, value: 0.5, halfLifeMs: 1000 } },
    emotions: { anger: { baseline: 0, value: 0, halfLifeMs: 1000 } } };
}
export function observation(id = 'event-1', time = 0): Observation {
  return { id, time, source: 'host', kind: 'speech', content: 'The agreement was broken.' };
}
export function proposal(): CognitionProposal {
  return { beliefUpdates: [], moodDeltas: {}, emotionDeltas: {}, metadata: { provider: 'fixture', model: null, explanation: null, parameters: {} } };
}
export const passive: CognitionProvider = { appraise: async () => proposal() };
