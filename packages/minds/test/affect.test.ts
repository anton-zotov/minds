import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMind } from '../src/index.js';
import { config, passive, proposal, observation } from './helpers.js';
test('simulation time decays affect toward baseline by half-life', async () => {
  const input = config(); input.emotions.anger!.value = 1;
  const mind = createMind(input, passive); await mind.advanceTime(1000);
  assert.equal(mind.getSnapshot().emotions.anger!.value, 0.5);
  assert.equal(mind.getSnapshot().mood.calm!.value, 0.5);
  const noop = await mind.advanceTime(1000); assert.equal(noop.snapshot.revision, 1); assert.deepEqual(noop.records, []);
  await assert.rejects(mind.advanceTime(999)); await assert.rejects(mind.advanceTime(NaN));
});
test('appraisal decays prior affect before applying bounded event deltas', async () => {
  const input = config(); input.emotions.anger!.value = 1;
  const mind = createMind(input, { appraise: async context => {
    assert.equal(context.mind.emotions.anger!.value, 0.5);
    return { ...proposal(), emotionDeltas: { anger: 0.2 }, moodDeltas: { calm: -2 } };
  } });
  await mind.ingest(observation('a', 1000));
  assert.equal(mind.getSnapshot().emotions.anger!.value, 0.7); assert.equal(mind.getSnapshot().mood.calm!.value, 0);
});
test('finite oversized deltas clamp without producing nonfinite state', async () => {
  const mind = createMind(config(), { appraise: async () => ({ ...proposal(), emotionDeltas: { anger: Number.MAX_VALUE } }) });
  await mind.ingest(observation()); assert.equal(mind.getSnapshot().emotions.anger!.value, 1);
});
