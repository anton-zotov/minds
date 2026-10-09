import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMind, restoreMind } from '../src/index.js';
import { createOpenRouterProvider } from '../src/providers/openrouter.js';
import { config, observation, proposal } from './helpers.js';

function staged(): any {
  return { appraise: async () => { throw new Error('legacy path must not run'); }, stages: {
    updateBeliefs: async () => ({ beliefUpdates: [{ id: 'access', statement: 'Access is blocked', confidence: 0.8, evidenceIds: ['event-1'] }], metadata: proposal().metadata }),
    appraiseEmotions: async (c: any) => {
      assert.equal(c.mind.beliefs[0].statement, 'Access is blocked'); assert.equal(c.mind.emotions.anger.value, 0);
      return { moodDeltas: { calm: -0.1 }, emotionDeltas: { anger: 0.3 }, metadata: proposal().metadata };
    },
  } };
}
test('beliefs update before emotional appraisal and both stages replay without inference', async () => {
  const p = staged(); const mind = createMind(config(), p); await mind.ingest(observation());
  assert.equal(mind.getSnapshot().emotions.anger!.value, 0.3); assert.equal(mind.getSnapshot().schemaVersion as number, 6);
  const calls = mind.getRecords().filter(r => r.type === 'decision'); assert.deepEqual(calls.map(r => (r.payload as any).stage), ['belief-update', 'emotional-appraisal']);
  assert.deepEqual(calls[1]!.causeIds, [calls[0]!.id]);
  const unavailable = { appraise: async () => { throw new Error('no inference'); }, stages: { updateBeliefs: async () => { throw new Error('no inference'); }, appraiseEmotions: async () => { throw new Error('no inference'); } } };
  assert.deepEqual(restoreMind(mind.exportRecording(), unavailable as any).getSnapshot(), mind.getSnapshot());
  const tampered: any = mind.exportRecording(); tampered.records.find((r: any) => r.payload?.stage === 'emotional-appraisal').payload.input.mind.beliefs = [];
  assert.throws(() => restoreMind(tampered, p));
});
test('late emotional failure rolls back beliefs, affect, memory and schema; no-change stages run for ordinary and clock events', async () => {
  const p = staged(); const mind = createMind(config(), p); const before = mind.exportRecording(); const emotional = p.stages.appraiseEmotions;
  p.stages.appraiseEmotions = async () => { throw new Error('late failure'); };
  await assert.rejects(mind.ingest(observation()), /late failure/); assert.deepEqual(mind.exportRecording(), before);
  p.stages.appraiseEmotions = emotional; await mind.ingest(observation()); assert.equal(mind.getSnapshot().memories.length, 1);
  p.stages.updateBeliefs = async () => ({ beliefUpdates: [], metadata: proposal().metadata });
  p.stages.appraiseEmotions = async () => ({ moodDeltas: {}, emotionDeltas: {}, metadata: proposal().metadata });
  await mind.ingest(observation('memory', 100)); await mind.advanceTime(200);
  assert.equal(mind.getRecords().filter(r => r.type === 'decision').length, 6);
});

function jevAnswers(questions: Record<string, any>, reject = false) {
  return { model: 'typesafe/jev-1.13', usage: { cost: 0.00002 }, answers: Object.fromEntries(Object.entries(questions).map(([id, q]) => [id,
    q.type === 'noul' ? { type: 'noul', noul: id.startsWith('adopt_') && reject ? 0.64 : 0.8 } :
    { type: 'score', score: 6, probabilities: Object.fromEntries(q.criteria.map((_: unknown, i: number) => [i, i === 6 ? 1 : 0])) }])) };
}
test('Jev judges belief adoption/confidence and signed emotions in separate requests with updated context', async () => {
  const requests: any[] = [];
  const p = createOpenRouterProvider({ apiKey: 'secret-split', model: 'luna', appraisalDecisionModel: 'typesafe/jev-1.13', fetch: async (_url: any, init: any) => {
    const b = JSON.parse(init.body); requests.push(b);
    if (b.questions) return Response.json(jevAnswers(b.questions));
    assert.equal(b.response_format.json_schema.name, 'mind_belief_proposals');
    return Response.json({ model: 'luna', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ candidates: [{ id: 'access', statement: 'Access is blocked', evidenceIds: ['event-1'] }], explanation: null }) } }] });
  } } as any);
  const mind = createMind(config(), p); await mind.ingest(observation());
  assert.equal(requests.length, 3); assert.equal(requests[2].state.context.mind.beliefs[0].statement, 'Access is blocked');
  assert.equal(mind.getSnapshot().beliefs[0]!.confidence, 0.8); assert.equal(mind.getSnapshot().emotions.anger!.value, 0.15);
  assert.equal(mind.getSnapshot().mood.calm!.value, 0.55);
  const calls = mind.getRecords().filter(r => r.type === 'decision');
  assert.equal((calls[0]!.payload as any).result.metadata.parameters.providerCalls, 2);
  assert.deepEqual(restoreMind(mind.exportRecording(), p).getSnapshot(), mind.getSnapshot());
});

test('planning receives revised beliefs and emotions; Mind completion retains schema 6', async () => {
  const p = staged(); const metadata = proposal().metadata;
  p.intentions = {
    generate: async (c: any) => {
      assert.equal(c.mind.beliefs[0].statement, 'Access is blocked'); assert.ok(c.mind.emotions.anger.value > 0);
      return { candidates: [{ id: 'a', description: 'Negotiate access', priority: 0.7, supportingBeliefIds: ['access'] }], metadata };
    }, evaluate: async () => ({ accept: true, scores: { goalAlignment: 1, feasibility: 1, emotionalCompatibility: 1, novelty: 1, compatibility: 1 }, metadata }),
    sufficient: async () => ({ sufficient: true, metadata }), reconsider: async () => ({ revisions: [], generateMore: false, metadata }),
  };
  const mind = createMind({ ...config(), intentionPolicy: { maxCandidates: 6, maxEvaluations: 6, maxActive: 3, seed: 42 } }, p);
  await mind.ingest(observation()); const id = mind.getSnapshot().intentions![0]!.id;
  p.stages.updateBeliefs = async () => ({ beliefUpdates: [], metadata });
  p.stages.appraiseEmotions = async () => ({ moodDeltas: {}, emotionDeltas: {}, metadata });
  p.intentions.reconsider = async () => ({ revisions: [{ intentionId: id, action: 'complete', evidenceIds: ['success'] }], generateMore: false, metadata });
  await mind.ingest(observation('success', 100)); assert.equal(mind.getSnapshot().intentions![0]!.status, 'completed');
  assert.equal(mind.getSnapshot().schemaVersion, 6); assert.deepEqual(restoreMind(mind.exportRecording(), p).getSnapshot(), mind.getSnapshot());
});

test('Jev rejection preserves beliefs and signed score endpoints map to configured limits', async () => {
  for (const score of [0, 4, 8]) {
    const character = config(); character.beliefs = [{ id: 'access', statement: 'Access is open', confidence: 0.9, evidenceIds: [] }];
    const p = createOpenRouterProvider({ apiKey: 'test', model: 'luna', appraisalDecisionModel: 'typesafe/jev-1.13', appraisalPolicy: { maxMoodDelta: 0.2, maxEmotionDelta: 0.4 }, fetch: async (_url, init) => {
      const b = JSON.parse(init!.body as string);
      if (!b.questions) return Response.json({ model: 'luna', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ candidates: [{ id: 'access', statement: 'Access is blocked', evidenceIds: ['event-1'] }], explanation: null }) } }] });
      const result = jevAnswers(b.questions, true);
      for (const [id, q] of Object.entries(b.questions) as [string, any][]) if (q.type === 'score') (result.answers as any)[id] = { type: 'score', score, probabilities: Object.fromEntries(q.criteria.map((_: unknown, i: number) => [i, i === score ? 1 : 0])) };
      if (Object.keys(b.questions).some(id => id.startsWith('affect_'))) assert.equal(b.state.context.mind.beliefs[0].statement, 'Access is open');
      return Response.json(result);
    } });
    const mind = createMind(character, p); await mind.ingest(observation()); assert.deepEqual(mind.getSnapshot().beliefs, character.beliefs);
    assert.equal(mind.getSnapshot().mood.calm!.value, 0.5 + (score - 4) / 4 * 0.2);
    assert.equal(mind.getSnapshot().emotions.anger!.value, Math.max(0, (score - 4) / 4 * 0.4));
  }
});

test('malformed Jev emotions and unsourced belief proposals roll back the entire event', async () => {
  for (const corrupt of ['emotion', 'evidence', 'repeated']) {
    const mind = createMind(config(), createOpenRouterProvider({ apiKey: 'test', model: 'luna', appraisalDecisionModel: 'typesafe/jev-1.13', fetch: async (_url, init) => {
      const b = JSON.parse(init!.body as string);
      if (!b.questions) {
        const candidate = { id: 'access', statement: 'Blocked', evidenceIds: corrupt === 'evidence' ? ['unknown'] : ['event-1'] };
        return Response.json({ model: 'luna', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ candidates: corrupt === 'repeated' ? [candidate, candidate] : [candidate], explanation: null }) } }] });
      }
      const result = jevAnswers(b.questions); if (Object.keys(b.questions).some(id => id.startsWith('affect_'))) delete (result.answers as any).affect_0;
      return Response.json(result);
    } }));
    const before = mind.exportRecording(); await assert.rejects(mind.ingest(observation())); assert.deepEqual(mind.exportRecording(), before);
  }
});

test('empty belief and affect stages expose skipped calls and invalid settings fail early', async () => {
  let count = 0;
  const p = createOpenRouterProvider({ apiKey: 'secret-split', model: 'luna', appraisalDecisionModel: 'typesafe/jev-1.13', fetch: async () => {
    count++; return Response.json({ model: 'luna', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ candidates: [], explanation: 'secret-split' }) } }] });
  } });
  const character = { ...config(), mood: {}, emotions: {} }; const mind = createMind(character, p); await mind.ingest(observation());
  assert.equal(count, 1); assert.equal(JSON.stringify(mind.exportRecording()).includes('secret-split'), false);
  assert.equal((mind.getRecords().find(r => (r.payload as any)?.stage === 'emotional-appraisal')!.payload as any).result.metadata.parameters.providerCalls, 0);
  for (const policy of [{ beliefAcceptanceThreshold: -0.1 }, { maxEmotionDelta: 2 }, { maxBeliefCandidates: 0 }, { unknown: 0.2 }]) assert.throws(() => createOpenRouterProvider({ apiKey: 'test', model: 'luna', appraisalDecisionModel: 'typesafe/jev-1.13', appraisalPolicy: policy } as any));
  assert.throws(() => createMind(config(), { ...staged(), stages: {} }));
});

test('mixed combined and split recordings replay stage order, inputs and confidence changes exactly', async () => {
  const legacy = { appraise: async () => proposal() }; const original = createMind(config(), legacy); await original.ingest(observation());
  const p = staged(); const mind = restoreMind(original.exportRecording(), p); await mind.ingest(observation('second', 100));
  assert.equal(mind.getSnapshot().schemaVersion, 6);
  const continued = restoreMind(mind.exportRecording(), legacy); await continued.ingest(observation('third', 200));
  assert.deepEqual(restoreMind(continued.exportRecording(), { appraise: async () => { throw new Error('replay must not infer'); } }).getSnapshot(), continued.getSnapshot());
  for (const field of ['input', 'result', 'order']) {
    const damaged: any = mind.exportRecording(); const index = damaged.records.findIndex((r: any) => r.payload?.stage === 'belief-update');
    if (field === 'input') damaged.records[index].payload.input.mind.emotions.anger.value = 0.5;
    if (field === 'result') damaged.records[index].payload.result.beliefUpdates[0].confidence = 0.1;
    if (field === 'order') [damaged.records[index], damaged.records[index + 1]] = [damaged.records[index + 1], damaged.records[index]];
    assert.throws(() => restoreMind(damaged, p));
  }
});

test('fractional emotion scores and exact adoption boundary preserve independent low belief confidence', async () => {
  const mind = createMind(config(), createOpenRouterProvider({ apiKey: 'test', model: 'luna', appraisalDecisionModel: 'typesafe/jev-1.13', fetch: async (_url, init) => {
    const b = JSON.parse(init!.body as string);
    if (!b.questions) return Response.json({ model: 'luna', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ candidates: [{ id: 'access', statement: 'Access is blocked', evidenceIds: ['event-1'] }], explanation: null }) } }] });
    const result = jevAnswers(b.questions);
    for (const id of Object.keys(result.answers)) (result.answers as any)[id] = id.startsWith('adopt_') ? { type: 'noul', noul: 0.65 } : id.startsWith('confidence_') ? { type: 'noul', noul: 0.01 } :
      { type: 'score', score: 4.5, probabilities: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0.5, 5: 0.5, 6: 0, 7: 0, 8: 0 } };
    return Response.json(result);
  } }));
  await mind.ingest(observation()); assert.equal(mind.getSnapshot().beliefs[0]!.confidence, 0.01);
  assert.equal(mind.getSnapshot().emotions.anger!.value, 0.0375);
});

test('planning failure after both appraisal stages rolls everything back and retry commits once', async () => {
  const p = staged(); let failed = true; const metadata = proposal().metadata;
  p.intentions = { generate: async (c: any) => { assert.equal(c.mind.emotions.anger.value, 0.3); if (failed) throw new Error('planning failed'); return { candidates: [], metadata }; },
    evaluate: async () => { throw new Error('not used'); }, sufficient: async () => { throw new Error('not used'); }, reconsider: async () => { throw new Error('not used'); } };
  const mind = createMind({ ...config(), intentionPolicy: { maxCandidates: 6, maxEvaluations: 6, maxActive: 3, seed: 42 } }, p); const before = mind.exportRecording();
  await assert.rejects(mind.ingest(observation()), /planning failed/); assert.deepEqual(mind.exportRecording(), before);
  failed = false; await mind.ingest(observation()); assert.equal(mind.getSnapshot().memories.length, 1);
  assert.deepEqual(restoreMind(mind.exportRecording(), p).getSnapshot(), mind.getSnapshot());
});
