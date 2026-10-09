import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMind, type InspectionRecord } from '../src/index.js';
import { config, observation, passive, proposal } from './helpers.js';
import { spawnSync } from 'node:child_process';
test('inspection links observations, memory, decisions, and before/after transitions', async () => {
  const mind = createMind(config(), { appraise: async () => ({ ...proposal(), emotionDeltas: { anger: 2 } }) });
  assert.equal(mind.getRecords()[0]!.sequence, 1);
  const result = await mind.ingest(observation());
  assert.deepEqual(result.records.map(record => record.type), ['observation', 'memory', 'decision', 'transition']);
  assert.deepEqual(result.records.map(record => record.sequence), [2, 3, 4, 5]);
  for (const record of result.records) { assert.equal(record.revision, 1); assert.equal(record.mindId, 'alice'); assert.equal(record.observationId, 'event-1'); }
  assert.deepEqual(result.records[1]!.causeIds, [result.records[0]!.id]);
  assert.deepEqual(result.records[3]!.causeIds, [result.records[2]!.id]);
  const decision = result.records[2]!.payload as any;
  assert.deepEqual(decision.retrievedMemoryIds, ['event-1']); assert.equal(decision.proposal.metadata.provider, 'fixture');
  const transition = result.records[3]!.payload as any;
  assert.equal(transition.before.emotions.anger.value, 0); assert.equal(transition.after.emotions.anger.value, 1);
  assert.equal(transition.requestedDeltas.emotions.anger, 2); assert.equal(transition.affectChanges.emotions[0].delta, 1);
  assert.equal(mind.getRecords(3).length, 2);
});
test('async subscriber rejection cannot terminate the host after a successful commit', () => {
  const script = `import { createMind } from '@minds/core';
    const mind = createMind(${JSON.stringify(config())}, { appraise: async () => (${JSON.stringify(proposal())}) });
    mind.subscribe(async () => { throw new Error('async subscriber failed'); });
    await mind.ingest(${JSON.stringify(observation())});
    await new Promise(resolve => setTimeout(resolve, 10));
    console.log(mind.getSnapshot().revision);`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr); assert.equal(child.stdout.trim(), '1');
});
test('no-change and clock events expose linked cognitive decisions', async () => {
  const mind = createMind(config(), passive);
  const result = await mind.ingest(observation());
  assert.deepEqual(result.records.map(r => r.type), ['observation', 'memory', 'decision', 'transition']);
  const advance = await mind.advanceTime(1000);
  assert.deepEqual(advance.records.map(r => r.type), ['observation', 'memory', 'decision', 'transition']);
  const clock = mind.getSnapshot().memories.at(-1)!.observation; assert.equal(clock.kind, 'elapsed-time');
  for (const record of advance.records) assert.equal(record.observationId, clock.id);
  assert.deepEqual(advance.records.at(-1)!.causeIds, [advance.records.at(-2)!.id]);
});
test('subscriptions cannot mutate state, break commits, or survive unsubscribe', async () => {
  const mind = createMind(config(), passive); let calls = 0; let observed: InspectionRecord[] = [];
  mind.subscribe(records => { records[0]!.sequence = 999; throw new Error('listener failure'); });
  const off = mind.subscribe(records => { calls++; observed = records; });
  await mind.ingest(observation()); assert.equal(observed[0]!.sequence, 2); assert.equal(calls, 1);
  off(); await mind.ingest(observation('b')); assert.equal(calls, 1);
  const returned = mind.getRecords(); returned[0]!.mindId = 'mutated';
  assert.equal(mind.getRecords()[0]!.mindId, 'alice'); assert.equal(mind.getSnapshot().revision, 2);
});
