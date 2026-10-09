import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMind, type CognitionContext } from '../src/index.js';
import { config, observation, passive, proposal } from './helpers.js';

test('appraisal commits memory, sourced belief, affect, and one revision', async () => {
  let context: CognitionContext | undefined;
  const mind = createMind(config(), { appraise: async input => {
    context = structuredClone(input); input.mind.config.identity.name = 'mutated';
    const result = proposal(); result.beliefUpdates = [{ id: 'trust', statement: 'The ally broke their promise', confidence: 0.8, evidenceIds: ['event-1'] }];
    result.emotionDeltas = { anger: 0.4 }; return result;
  } });
  const result = await mind.ingest(observation());
  assert.equal(result.snapshot.revision, 1); assert.equal(result.snapshot.memories[0]!.id, 'event-1');
  assert.equal(result.snapshot.beliefs[0]!.confidence, 0.8); assert.equal(result.snapshot.emotions.anger!.value, 0.4);
  assert.equal(mind.getSnapshot().config.identity.name, 'alice');
  assert.deepEqual(context!.memories.map(item => item.id), ['event-1']);
  assert.equal(Object.hasOwn(context!, 'worldFacts'), false);
});
test('non-enumerable observation IDs are rejected before cloning or commit', async () => {
  const event = observation(); Object.defineProperty(event, 'id', { value: 'hidden-id', enumerable: false });
  const mind = createMind(config(), passive); const before = mind.exportRecording();
  await assert.rejects(mind.ingest(event)); assert.deepEqual(mind.exportRecording(), before);
});
test('no-change cognition remembers content and records its decision', async () => {
  let calls = 0; const mind = createMind(config(), { appraise: async () => { calls++; return proposal(); } });
  await mind.ingest(observation()); assert.equal(calls, 1);
  assert.deepEqual(mind.getSnapshot().memories[0]!.observation, observation());
  assert.equal(mind.getRecords().filter(r => r.type === 'decision').length, 1);
});
test('duplicate IDs remain idempotent after time advances and under concurrency', async () => {
  let calls = 0;
  const mind = createMind(config(), { appraise: async () => { calls++; await Promise.resolve(); return proposal(); } });
  const results = await Promise.all([mind.ingest(observation()), mind.ingest(observation())]);
  assert.deepEqual(results.map(value => value.duplicate), [false, true]); assert.equal(calls, 1);
  await mind.advanceTime(100);
  const duplicate = await mind.ingest(observation());
  assert.equal(duplicate.duplicate, true); assert.equal(duplicate.snapshot.revision, 2); assert.deepEqual(duplicate.records, []);
});
test('concurrent observations serialize without losing memory or affect', async () => {
  const mind = createMind(config(), { appraise: async () => ({ ...proposal(), emotionDeltas: { anger: 0.2 } }) });
  const first = observation('a'); const promise = mind.ingest(first); first.id = 'changed';
  await Promise.all([promise, mind.ingest(observation('b'))]);
  assert.deepEqual(mind.getSnapshot().memories.map(item => item.id), ['a', 'b']);
  assert.equal(mind.getSnapshot().emotions.anger!.value, 0.4);
});
test('provider exceptions rollback everything and retries work after queue failure', async () => {
  let attempts = 0;
  const mind = createMind(config(), { appraise: async () => { if (++attempts === 1) throw new Error('offline'); return proposal(); } });
  const before = mind.getSnapshot(); await assert.rejects(mind.ingest(observation('a', 500)), /offline/);
  assert.deepEqual(mind.getSnapshot(), before);
  await mind.ingest(observation('a', 500)); assert.equal(mind.getSnapshot().revision, 1);
});
test('invalid cognitive proposals cannot commit or mark observations processed', async () => {
  const invalid = [
    { ...proposal(), emotionDeltas: { anger: NaN } },
    { ...proposal(), moodDeltas: { unknown: 0.2 } },
    { ...proposal(), beliefUpdates: [{ id: 'b', statement: 'Claim', confidence: 1.1, evidenceIds: [] }] },
    { ...proposal(), beliefUpdates: [{ id: 'b', statement: 'Claim', confidence: 0.5, evidenceIds: ['foreign'] }] },
  ];
  for (const bad of invalid) {
    let valid = false; const mind = createMind(config(), { appraise: async () => valid ? proposal() : bad });
    const before = mind.getSnapshot(); await assert.rejects(mind.ingest(observation()));
    assert.deepEqual(mind.getSnapshot(), before); valid = true;
    assert.equal((await mind.ingest(observation())).duplicate, false);
  }
});
test('retrieval bounds provider context while durable memory retains all events', async () => {
  let received: CognitionContext | undefined;
  const mind = createMind(config(), { appraise: async input => { received = input; return proposal(); } });
  for (let i = 0; i < 22; i++) { await mind.ingest(observation(`e${i}`, i)); }
  assert.equal(received!.memories.length, 20); assert.equal(received!.mind.memories.length, 20);
  assert.equal(received!.memories[0]!.id, 'e2'); assert.equal(received!.memories.at(-1)!.id, 'e21');
  assert.equal(mind.getSnapshot().memories.length, 22);
});
test('malformed observations and unsupported world context are rejected', async () => {
  const mind = createMind(config(), passive);
  await assert.rejects(mind.ingest({ ...observation(), time: -1 }));
  await assert.rejects(mind.ingest({ ...observation(), worldFacts: ['secret'] } as never));
  assert.equal(mind.getSnapshot().revision, 0);
});
