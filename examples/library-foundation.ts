import { createMind, restoreMind, type MindConfig, type MindRecording, type MindSnapshot, type CognitionProvider } from '@minds/core';
import { pathToFileURL } from 'node:url';

export function exampleConfig(id = 'alice'): MindConfig {
  return { runId: 'foundation-demo', mindId: id, identity: { name: id, description: 'Cautious, protective of public access.' },
    goal: 'Keep the resource publicly accessible', time: 0, beliefs: [],
    mood: { calm: { baseline: 0.5, value: 0.5, halfLifeMs: 1000 } },
    emotions: { anger: { baseline: 0, value: 0, halfLifeMs: 1000 } } };
}
export async function runFoundation(): Promise<{ recording: MindRecording; secondSnapshot: MindSnapshot; duplicate: boolean }> {
  // This deterministic provider is a mechanics fixture, not an autonomous AI model.
  const fixture: CognitionProvider = { appraise: async context => ({
    beliefUpdates: context.observation.kind === 'elapsed-time' ? [] : [{ id: 'agreement', statement: 'The agreement may not be reliable', confidence: 0.7, evidenceIds: [context.observation.id] }],
    moodDeltas: {}, emotionDeltas: context.observation.kind === 'elapsed-time' ? {} : { anger: context.mind.config.identity.description.includes('Cautious') ? 0.4 : 0.7 },
    metadata: { provider: 'deterministic-fixture', model: null, explanation: 'Demonstrates sourced belief updates and bounded affect.', parameters: {} },
  }) };
  const first = createMind(exampleConfig(), fixture); const secondConfig = exampleConfig('bob');
  secondConfig.identity.description = 'Impulsive and impatient.';
  const second = createMind(secondConfig, fixture);
  const event = { id: 'agreement-broken', time: 0, source: 'demo-host', kind: 'speech', content: 'Our partner says they broke the agreement.' };
  await first.ingest(event); const duplicate = (await first.ingest(event)).duplicate;
  const restored = restoreMind(JSON.parse(JSON.stringify(first.exportRecording())), fixture);
  await restored.advanceTime(1000);
  return { recording: restored.exportRecording(), secondSnapshot: second.getSnapshot(), duplicate };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runFoundation();
  if (process.argv.includes('--recording')) console.log(JSON.stringify(result.recording, null, 2));
  else console.log(JSON.stringify({ fixture: 'deterministic; no live inference', duplicateIgnored: result.duplicate,
    unaffectedMindRevision: result.secondSnapshot.revision, restoredRevision: result.recording.snapshot.revision,
    angerAfterOneHalfLife: result.recording.snapshot.emotions.anger!.value,
    timeline: result.recording.records.map(record => ({ sequence: record.sequence, type: record.type, time: record.time, causeIds: record.causeIds })) }, null, 2));
}
