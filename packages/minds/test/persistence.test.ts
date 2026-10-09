import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMind, restoreMind } from '../src/index.js';
import { config, observation, passive } from './helpers.js';
test('recordings JSON round-trip and preserve identity, deduplication, and sequences', async () => {
  const mind = createMind(config(), passive); await mind.ingest(observation());
  const recording = JSON.parse(JSON.stringify(mind.exportRecording()));
  const restored = restoreMind(recording, passive);
  assert.deepEqual(restored.getSnapshot(), mind.getSnapshot());
  const duplicate = await restored.ingest(observation()); assert.equal(duplicate.duplicate, true);
  await restored.ingest(observation('b', 100)); assert.equal(restored.getRecords().at(-1)!.sequence, 9);
  assert.equal(restored.getSnapshot().revision, 2);
  recording.snapshot.config.identity.name = 'changed'; assert.equal(restored.getSnapshot().config.identity.name, 'alice');
});
test('sparse recording arrays cannot compare as empty arrays or corrupt restored memory', () => {
  const recording = createMind(config(), passive).exportRecording(); recording.snapshot.memories = Array(1);
  assert.throws(() => restoreMind(recording, passive));
});
test('restoration rejects unsupported, corrupt, or contradictory recordings', async () => {
  const mind = createMind(config(), passive); await mind.ingest(observation());
  for (const corrupt of [
    (r: any) => { r.schemaVersion = 2; },
    (r: any) => { r.records[0].mindId = 'foreign'; },
    (r: any) => { r.records[1].sequence = 1; },
    (r: any) => { r.snapshot.emotions.anger.value = 2; },
    (r: any) => { r.processedObservationIds = []; },
    (r: any) => { r.snapshot.goal = 'unsupported'; },
    (r: any) => { r.snapshot.time = 999; },
    (r: any) => { r.records[2].causeIds = ['missing']; },
    (r: any) => { r.records.pop(); },
  ]) {
    const recording = mind.exportRecording(); corrupt(recording); assert.throws(() => restoreMind(recording, passive));
  }
});
test('recordings and provider references remain detached from runtime state', async () => {
  const mind = createMind(config(), passive); await mind.ingest(observation());
  const recording = mind.exportRecording(); recording.snapshot.memories[0]!.observation.content = 'changed';
  recording.processedObservationIds.length = 0; recording.records.length = 0;
  assert.equal(mind.getSnapshot().memories[0]!.observation.content, 'The agreement was broken.');
  assert.equal((await mind.ingest(observation())).duplicate, true);
});
