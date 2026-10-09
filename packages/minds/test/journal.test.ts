import test from 'node:test';
import assert from 'node:assert/strict';
import { createMind, restoreMind } from '../src/index.js';
import { config, observation, passive, proposal } from './helpers.js';

test('compact history restores exact inspection and supports continued cognition', async () => {
  const mind = createMind(config(), passive);
  for (let i = 0; i < 12; i++) await mind.ingest(observation(`e-${i}`, i * 100));
  await mind.advanceTime(2000);
  assert.equal(mind.getRecordCount(), mind.getRecords().length);
  assert.deepEqual(mind.getRecords(mind.getRecordCount()), []);
  const compact = (mind as any).exportCompactRecording?.();
  assert.ok(compact, 'runtime must expose a compact event journal');
  assert.ok(JSON.stringify(compact).length < JSON.stringify(mind.exportRecording()).length / 4);
  const restored = restoreMind(compact, passive);
  assert.deepEqual(restored.exportRecording(), mind.exportRecording());
  await restored.ingest(observation('continued', 3000)); await mind.ingest(observation('continued', 3000));
  assert.deepEqual(restored.exportRecording(), mind.exportRecording());
  assert.deepEqual(restoreMind(mind.exportRecording(), passive).exportRecording(), mind.exportRecording());
  assert.equal((await restored.ingest(observation('continued', 3000))).duplicate, true);
});

test('compact staged planning and Mind completion replay without inference', async () => {
  const metadata = proposal().metadata;
  const provider: any = { ...passive, stages: {
    updateBeliefs: async (c: any) => ({ beliefUpdates: [{ id: 'b', statement: 'Access matters', confidence: 0.6, evidenceIds: [c.observation.id] }], metadata }),
    appraiseEmotions: async () => ({ moodDeltas: {}, emotionDeltas: { anger: 0.2 }, metadata }),
  }, intentions: {
    generate: async () => ({ candidates: [{ id: 'a', description: 'Ask a neighbor', priority: 0.7, supportingBeliefIds: ['b'] }], metadata }),
    evaluate: async () => ({ accept: true, scores: { goalAlignment: 1, feasibility: 1, emotionalCompatibility: 1, novelty: 1, compatibility: 1 }, metadata }),
    sufficient: async () => ({ sufficient: true, metadata }),
    reconsider: async () => ({ revisions: [], generateMore: false, metadata }),
  } };
  const mind = createMind({ ...config(), intentionPolicy: { maxCandidates: 3, maxEvaluations: 3, maxActive: 2, seed: 42 } }, provider);
  await mind.ingest(observation());
  provider.intentions.reconsider = async (c: any) => ({ revisions: [{ intentionId: c.mind.intentions[0].id, action: 'complete', evidenceIds: [c.observation.id] }], generateMore: false, metadata });
  await mind.ingest(observation('done', 100));
  const journal = mind.exportCompactRecording();
  const unavailable: any = { appraise: async () => { throw new Error('offline'); }, intentions: Object.fromEntries(['generate', 'evaluate', 'sufficient', 'reconsider'].map(k => [k, async () => { throw new Error('offline'); }])) };
  assert.deepEqual(restoreMind(journal, unavailable).exportRecording(), mind.exportRecording());
  const damaged: any = structuredClone(journal); damaged.operations[0].appraisalCalls.reverse();
  assert.throws(() => restoreMind(damaged, provider));
  const missing: any = structuredClone(journal); delete missing.operations[0].intentionCalls;
  assert.throws(() => restoreMind(missing, provider));
  const unexpected: any = structuredClone(journal); unexpected.operations[1].proposal = proposal();
  assert.throws(() => restoreMind(unexpected, provider));
  const duplicate: any = structuredClone(journal); duplicate.operations.push(duplicate.operations[1]);
  assert.throws(() => restoreMind(duplicate, provider));
  const withInput: any = structuredClone(journal); withInput.operations[0].appraisalCalls[0].input = {};
  assert.throws(() => restoreMind(withInput, provider));
});
