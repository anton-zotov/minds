import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runFoundation } from '../../../examples/library-foundation.js';
import { restoreMind } from '@minds/core';
import { passive } from './helpers.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('public package example isolates Minds and supplies a restorable causal recording', async () => {
  const result = await runFoundation();
  assert.equal(result.secondSnapshot.revision, 0); assert.equal(result.secondSnapshot.memories.length, 0);
  assert.equal(result.duplicate, true); assert.equal(result.recording.snapshot.revision, 2);
  assert.equal(result.recording.snapshot.emotions.anger!.value, 0.2);
  const restored = restoreMind(JSON.parse(JSON.stringify(result.recording)), passive);
  assert.deepEqual(restored.getSnapshot(), result.recording.snapshot);
  const records = result.recording.records;
  assert.deepEqual(records.map((record: any) => record.type), ['initialized', 'observation', 'memory', 'decision', 'transition', 'observation', 'memory', 'decision', 'transition']);
  assert.deepEqual(records[4]!.causeIds, [records[3]!.id]);
});
test('live example reports missing environment settings before making requests', () => {
  const env = { ...process.env }; delete env.OPENROUTER_API_KEY; delete env.OPENROUTER_APPRAISAL_MODEL;
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('../../../examples/openrouter-foundation.js', import.meta.url))], { env, encoding: 'utf8' });
  assert.equal(run.status, 1); assert.match(run.stderr, /OPENROUTER_API_KEY.*OPENROUTER_APPRAISAL_MODEL/);
  assert.equal(run.stdout, '');
});
