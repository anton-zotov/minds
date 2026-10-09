import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMind, restoreMind, type CognitionProvider } from '../src/index.js';
import { config, observation, proposal } from './helpers.js';

const planned = () => ({ ...config(), intentionPolicy: { maxCandidates: 6, maxEvaluations: 6, maxActive: 3, seed: 42 } });
function provider(): CognitionProvider {
  return { appraise: async () => proposal(), intentions: {
    generate: async () => ({ candidates: [{ id: 'a', description: 'Negotiate fair access', priority: 0.7, supportingBeliefIds: [] }], metadata: proposal().metadata }),
    evaluate: async () => ({ accept: true, scores: { goalAlignment: 1, feasibility: 1, emotionalCompatibility: 1, novelty: 1, compatibility: 1 }, metadata: proposal().metadata }),
    sufficient: async () => ({ sufficient: true, metadata: proposal().metadata }),
    reconsider: async () => ({ revisions: [], generateMore: false, metadata: proposal().metadata }),
  } };
}
function complete(p: CognitionProvider, ids?: string[], generateMore = false) {
  p.intentions!.reconsider = async c => ({ revisions: (ids ?? c.mind.intentions!.map(i => i.id)).map(intentionId => ({ intentionId, action: 'complete', evidenceIds: [c.observation.id] })), generateMore, metadata: proposal().metadata });
}
test('Mind completion preserves identity, sourced evidence, replay and deduplication without a new pool', async () => {
  const p = provider(); const mind = createMind(planned(), p); await mind.ingest(observation()); const original = mind.getSnapshot().intentions![0]!; complete(p);
  p.intentions!.generate = async () => { throw new Error('must respect generateMore false'); };
  const result = await mind.ingest(observation('success', 100)); const completed = mind.getSnapshot().intentions![0]!;
  assert.equal(completed.status, 'completed');
  for (const key of ['id', 'description', 'goal', 'originObservationId', 'createdAt'] as const) assert.equal(completed[key], original[key]);
  assert.equal(completed.reconsideredAt, 100); assert.deepEqual(completed.evidenceIds, ['success']);
  assert.equal(mind.exportRecording().schemaVersion, 6); assert.equal(result.records.at(-1)!.observationId, 'success'); assert.ok(result.records.some(r => r.type === 'decision'));
  assert.deepEqual(restoreMind(mind.exportRecording(), p).getSnapshot(), mind.getSnapshot());
  const saved = mind.exportRecording(); assert.equal((await mind.ingest(observation('success', 100))).duplicate, true); assert.deepEqual(mind.exportRecording(), saved);
});
test('observable completion prose permits a no-change judgment', async () => {
  const mind = createMind(planned(), provider()); await mind.ingest(observation()); await mind.ingest({ ...observation('prose', 100), content: 'All strategies are complete.' });
  assert.equal(mind.getSnapshot().intentions![0]!.status, 'active');
});
test('unknown, duplicate, empty and non-triggering completion evidence reject atomically', async () => {
  for (const evidenceIds of [[], ['missing'], ['success', 'success'], ['event-1']]) {
    const p = provider(); const mind = createMind(planned(), p); await mind.ingest(observation());
    p.intentions!.reconsider = async c => ({ revisions: [{ intentionId: c.mind.intentions![0]!.id, action: 'complete', evidenceIds }], generateMore: false, metadata: proposal().metadata });
    const before = mind.exportRecording(); await assert.rejects(mind.ingest(observation('success', 100))); assert.deepEqual(mind.exportRecording(), before);
  }
  const p = provider(); const mind = createMind(planned(), p); await mind.ingest(observation()); complete(p, ['missing']); const before = mind.exportRecording();
  await assert.rejects(mind.ingest(observation('success', 100))); assert.deepEqual(mind.exportRecording(), before);
});
test('completed strategies remain terminal and recording tampering fails', async () => {
  const p = provider(); const mind = createMind(planned(), p); await mind.ingest(observation()); const id = mind.getSnapshot().intentions![0]!.id; complete(p); await mind.ingest(observation('success', 100));
  const altered: any = mind.exportRecording(); altered.snapshot.intentions[0].evidenceIds = ['event-1']; assert.throws(() => restoreMind(altered, p));
  const downgraded: any = mind.exportRecording(); downgraded.schemaVersion = 2; assert.throws(() => restoreMind(downgraded, p));
  p.intentions!.generate = async () => ({ candidates: [{ id: 'new', description: 'Monitor agreement', priority: 0.7, supportingBeliefIds: [] }], metadata: proposal().metadata });
  await mind.ingest(observation('next', 150));
  for (const action of ['complete', 'revise', 'suspend'] as const) {
    p.intentions!.reconsider = async () => ({ revisions: [{ intentionId: id, action, description: 'Revive', evidenceIds: ['revival'] }], generateMore: false, metadata: proposal().metadata });
    const before = mind.exportRecording(); await assert.rejects(mind.ingest(observation('revival', 200))); assert.deepEqual(mind.exportRecording(), before);
  }
});
test('suspended strategies can complete together; abandoned strategies cannot', async () => {
  const p = provider(); p.intentions!.generate = async () => ({ candidates: ['Negotiate', 'Organize'].map(id => ({ id, description: id, priority: 0.7, supportingBeliefIds: [] })), metadata: proposal().metadata });
  p.intentions!.sufficient = async () => ({ sufficient: false, metadata: proposal().metadata });
  const mind = createMind(planned(), p); await mind.ingest(observation());
  p.intentions!.reconsider = async c => ({ revisions: c.mind.intentions!.map(i => ({ intentionId: i.id, action: 'suspend', evidenceIds: [c.observation.id] })), generateMore: false, metadata: proposal().metadata });
  await mind.ingest(observation('suspend', 50)); assert.ok(mind.getSnapshot().intentions!.every(i => i.status === 'suspended'));
  complete(p); await mind.ingest(observation('success', 100)); assert.ok(mind.getSnapshot().intentions!.every(i => i.status === 'completed'));
  assert.deepEqual(restoreMind(mind.exportRecording(), { appraise: async () => { throw new Error('no restore inference'); }, intentions: Object.fromEntries(['generate', 'evaluate', 'sufficient', 'reconsider'].map(k => [k, async () => { throw new Error('no restore inference'); }])) as any }).getSnapshot(), mind.getSnapshot());
  const other = provider(); const abandoned = createMind(planned(), other); await abandoned.ingest(observation());
  other.intentions!.reconsider = async c => ({ revisions: [{ intentionId: c.mind.intentions![0]!.id, action: 'abandon', evidenceIds: [c.observation.id] }], generateMore: false, metadata: proposal().metadata });
  await abandoned.ingest(observation('abandon', 50));
  const retired = abandoned.getSnapshot().intentions![0]!.id;
  other.intentions!.generate = async () => ({ candidates: [{ id: 'new', description: 'Monitor access', priority: 0.7, supportingBeliefIds: [] }], metadata: proposal().metadata });
  await abandoned.ingest(observation('next', 75)); complete(other, [retired]); const before = abandoned.exportRecording();
  await assert.rejects(abandoned.ingest(observation('success', 100))); assert.deepEqual(abandoned.exportRecording(), before);
});
test('late planning failure rolls back completion, cognition and memory; retry commits once', async () => {
  const p = provider(); const mind = createMind(planned(), p); await mind.ingest(observation()); const before = mind.exportRecording();
  p.appraise = async () => ({ ...proposal(), emotionDeltas: { anger: 0.9 } }); complete(p, undefined, true);
  p.intentions!.generate = async c => { assert.equal(c.mind.intentions![0]!.status, 'completed'); assert.equal(c.mind.emotions.anger!.value, 0.9); throw new Error('Late planning failure'); };
  await assert.rejects(mind.ingest(observation('success', 100)), /Late planning failure/); assert.deepEqual(mind.exportRecording(), before);
  complete(p); await mind.ingest(observation('success', 100)); assert.equal(mind.getSnapshot().intentions![0]!.status, 'completed'); assert.equal(mind.getSnapshot().memories.filter(m => m.id === 'success').length, 1);
});
