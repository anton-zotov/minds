import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMind } from '../src/index.js';
import { config, passive } from './helpers.js';

test('initialization isolates configuration, returned state, and other Minds', () => {
  const input = config(); const first = createMind(input, passive); const second = createMind(config('bob'), passive);
  input.emotions.anger!.value = 1;
  const snapshot = first.getSnapshot(); snapshot.emotions.anger!.value = 0.8; snapshot.config.identity.name = 'changed';
  assert.equal(first.getSnapshot().revision, 0);
  assert.equal(first.getSnapshot().config.identity.name, 'alice');
  assert.equal(first.getSnapshot().config.goal, 'Protect public access');
  assert.equal(first.getSnapshot().emotions.anger!.value, 0);
  assert.equal(second.getSnapshot().emotions.anger!.value, 0);
  assert.deepEqual(first.getSnapshot().memories, []);
});
test('non-enumerable configuration fields cannot disappear from persisted identity', () => {
  const input = config(); Object.defineProperty(input, 'time', { value: 0, enumerable: false });
  assert.throws(() => createMind(input, passive));
});
test('invalid initial configuration is rejected rather than normalized silently', () => {
  for (const value of [NaN, Infinity, -1]) { const input = config(); input.time = value; assert.throws(() => createMind(input, passive)); }
  for (const halfLife of [0, -1, NaN, Infinity]) { const input = config(); input.emotions.anger!.halfLifeMs = halfLife; assert.throws(() => createMind(input, passive)); }
  for (const id of ['', '  ']) { const input = config(id); assert.throws(() => createMind(input, passive)); }
  const duplicate = config(); duplicate.beliefs = [1, 2].map(() => ({ id: 'same', statement: 'Known', confidence: 0.7, evidenceIds: [] }));
  assert.throws(() => createMind(duplicate, passive));
  const outOfBounds = config(); outOfBounds.emotions.anger!.value = 1.1; assert.throws(() => createMind(outOfBounds, passive));
});
