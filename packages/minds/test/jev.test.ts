import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMind, restoreMind } from '../src/index.js';
import { createOpenRouterProvider } from '../src/providers/openrouter.js';
import { config, observation } from './helpers.js';
const apiKey = 'jev-test-secret';
const planned = () => ({ ...config(), intentionPolicy: { maxCandidates: 6, maxEvaluations: 6, maxActive: 3, seed: 42 } });
const noul = (value: number) => ({ type: 'noul', noul: value });
function choice(options: string[], selected: string) { return { type: 'choice', choice: selected, confidence: 0.9, probabilities: Object.fromEntries(options.map(k => [k, k === selected ? 1 : 0])) }; }
function score(value = 3) { return { type: 'score', score: value, confidence: 0.8, probabilities: { '0': 0, '1': 0, '2': 0, '3': 1, '4': 0 } }; }
function decisions(questions: Record<string, any>, overrides: Record<string, any> = {}) {
  return { id: 'decision-1', provider: 'TypeSafe', model: 'typesafe/jev-1.13-20260917',
    answers: Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, overrides[id] ?? (q.type === 'score' ? score() : q.type === 'choice' ? choice(Object.keys(q.criteria), 'keep') : noul(id === 'generate_more' ? 0.1 : 0.9))])),
    usage: { input_tokens: 400, output_tokens: 40, cost: 0.00002 } };
}
function chat(name: string, request: any): Response {
  let output: unknown;
  if (name === 'mind_appraisal') output = { beliefUpdates: [], moodDeltas: {}, emotionDeltas: { anger: 0.2 }, explanation: 'Appraise' };
  else if (name === 'mind_intention_revision_proposals') {
    const c = JSON.parse(request.messages[1].content);
    output = { revisions: c.requestedRevisionIds.map((intentionId: string) => ({ intentionId, action: 'revise', description: 'Monitor renewed access', priority: 0.8, supportingBeliefIds: [], evidenceIds: [c.observation.id] })), explanation: 'Proposed wording' };
  } else output = { candidates: [{ id: 'a', description: 'Negotiate access', priority: 0.8, supportingBeliefIds: [] }], explanation: 'Generated strategy' };
  return Response.json({ id: 'chat-1', model: 'generation-model', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }], usage: { total_tokens: 100 } });
}
function provider(fetcher: typeof fetch, extra = {}) { return createOpenRouterProvider({ apiKey, model: 'appraisal', intentions: true, intentionGenerationModel: 'generator', intentionDecisionModel: 'typesafe/jev-1.13', fetch: fetcher, ...extra } as any); }

test('hybrid cognition uses Jev decisions for judgments and chat only for appraisal and generation', async () => {
  const requests: any[] = [];
  const p = provider(async (url, init) => {
    const body = JSON.parse(init!.body as string); requests.push({ url, body });
    assert.equal(new Headers(init!.headers).get('Authorization'), `Bearer ${apiKey}`);
    if (body.questions) {
      assert.equal(url, 'https://openrouter.ai/api/alpha/decisions'); assert.equal(body.model, 'typesafe/jev-1.13');
      assert.equal(Object.hasOwn(body, 'messages'), false); assert.equal(Object.hasOwn(body, 'response_format'), false);
      assert.equal(Object.hasOwn(body.state, 'worldFacts'), false);
      return Response.json(decisions(body.questions));
    }
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions'); assert.notEqual(body.model, 'typesafe/jev-1.13');
    return chat(body.response_format.json_schema.name, body);
  });
  const mind = createMind(planned(), p); await mind.ingest(observation()); const adopted = mind.getSnapshot().intentions;
  await mind.ingest(observation('next', 100)); assert.deepEqual(mind.getSnapshot().intentions, adopted);
  assert.equal(requests.filter(r => r.body.questions).length, 3);
  assert.equal(requests.filter(r => r.body.messages).length, 3);
  const evaluation = mind.getRecords().find(r => (r.payload as any)?.stage === 'intention-evaluation')!.payload as any;
  assert.equal(evaluation.result.accept, true); assert.equal(evaluation.result.scores.goalAlignment, 0.75);
  assert.equal(evaluation.result.metadata.explanation, null);
  assert.equal(evaluation.result.metadata.model, 'typesafe/jev-1.13-20260917');
  assert.equal(evaluation.result.metadata.parameters.usage.input_tokens, 400);
  assert.equal(evaluation.result.metadata.parameters.response.answers.accept.noul, 0.9);
  assert.equal(evaluation.result.metadata.parameters.decisionPolicy.acceptThreshold, 0.65);
  assert.deepEqual(restoreMind(mind.exportRecording(), p).getSnapshot(), mind.getSnapshot());
});

test('recorded acceptance and sufficiency thresholds control decisions at the boundary', async () => {
  for (const [probability, accepted] of [[0.649, false], [0.65, true]] as const) {
    const mind = createMind(planned(), provider(async (_url, init) => {
      const body = JSON.parse(init!.body as string);
      return body.questions ? Response.json(decisions(body.questions, { accept: noul(probability) })) : chat(body.response_format.json_schema.name, body);
    }));
    await mind.ingest(observation()); assert.equal(mind.getSnapshot().intentions!.length, accepted ? 1 : 0);
  }
  assert.throws(() => provider(async () => Response.json({}), { jevPolicy: { acceptThreshold: 1.1 } }));
});

test('Jev lifecycle changes preserve IDs, gate generation, and generate revised wording only on demand', async () => {
  const requests: any[] = [];
  const p = provider(async (url, init) => {
    const body = JSON.parse(init!.body as string); requests.push({ url, body });
    if (!body.questions) return chat(body.response_format.json_schema.name, body);
    const override: Record<string, any> = {};
    for (const [id, q] of Object.entries(body.questions) as [string, any][]) if (q.type === 'choice') override[id] = choice(Object.keys(q.criteria), 'revise');
    return Response.json(decisions(body.questions, override));
  });
  const mind = createMind(planned(), p); await mind.ingest(observation()); const id = mind.getSnapshot().intentions![0]!.id;
  await mind.ingest(observation('reopened', 100));
  assert.equal(mind.getSnapshot().intentions![0]!.id, id); assert.equal(mind.getSnapshot().intentions![0]!.description, 'Monitor renewed access');
  assert.deepEqual(mind.getSnapshot().intentions![0]!.evidenceIds, ['reopened']);
  assert.equal(requests.filter(r => r.body.response_format?.json_schema.name === 'mind_intention_revision_proposals').length, 1);
  const revision = mind.getRecords().findLast(r => (r.payload as any)?.stage === 'intention-reconsideration')!.payload as any;
  assert.equal(revision.result.metadata.parameters.providerCalls, 3);
  assert.equal(revision.result.metadata.parameters.additionalOperations.length, 2);
  assert.deepEqual(restoreMind(mind.exportRecording(), p).getSnapshot(), mind.getSnapshot());
});

test('malformed Jev answers, HTTP failures and timeouts roll back all earlier cognition', async () => {
  for (const corrupt of [
    (r: any) => { delete r.answers.accept; }, (r: any) => { r.answers.accept.noul = 1.2; },
    (r: any) => { r.answers.goalAlignment.type = 'choice'; }, (r: any) => { r.answers.goalAlignment.score = 5; },
    (r: any) => { r.answers.goalAlignment.probabilities['3'] = 0.5; }, (r: any) => { r.error = { message: apiKey }; },
  ]) {
    const mind = createMind(planned(), provider(async (_url, init) => {
      const b = JSON.parse(init!.body as string); if (!b.questions) return chat(b.response_format.json_schema.name, b);
      const result = decisions(b.questions); corrupt(result); return Response.json(result);
    }));
    const before = mind.exportRecording(); await assert.rejects(mind.ingest(observation()), e => !String(e).includes(apiKey)); assert.deepEqual(mind.exportRecording(), before);
  }
  const mind = createMind(planned(), provider(async (_url, init) => {
    const b = JSON.parse(init!.body as string); if (!b.questions) return chat(b.response_format.json_schema.name, b);
    return new Promise((_r, reject) => init!.signal!.addEventListener('abort', () => reject(new Error(apiKey))));
  }, { timeoutMs: 10 }));
  const before = mind.exportRecording(); await assert.rejects(mind.ingest(observation()), (e: any) => e.code === 'timeout'); assert.deepEqual(mind.exportRecording(), before);
});

test('Jev raw responses cannot echo credentials into metadata or diagnostics', async () => {
  const mind = createMind(planned(), provider(async (_url, init) => {
    const b = JSON.parse(init!.body as string); if (!b.questions) return chat(b.response_format.json_schema.name, b);
    return Response.json({ ...decisions(b.questions), provider: apiKey, id: apiKey });
  }));
  await mind.ingest(observation()); assert.equal(JSON.stringify(mind.exportRecording()).includes(apiKey), false);
});

test('uncertain lifecycle choices and rejected revised wording preserve commitments', async () => {
  for (const uncertain of [true, false]) {
    let proposals = 0;
    const mind = createMind(planned(), provider(async (_url, init) => {
      const b = JSON.parse(init!.body as string);
      if (!b.questions) { if (b.response_format.json_schema.name === 'mind_intention_revision_proposals') proposals++; return chat(b.response_format.json_schema.name, b); }
      const overrides: Record<string, any> = {};
      for (const [id, q] of Object.entries(b.questions) as [string, any][]) {
        if (q.type === 'choice') {
          overrides[id] = choice(Object.keys(q.criteria), 'revise');
          if (uncertain) { overrides[id].probabilities.revise = 0.6; overrides[id].probabilities.keep = 0.4; }
        }
        if (id.startsWith('apply_')) overrides[id] = noul(0.64);
      }
      return Response.json(decisions(b.questions, overrides));
    }));
    await mind.ingest(observation()); const before = mind.getSnapshot().intentions;
    await mind.ingest(observation('change', 100)); assert.deepEqual(mind.getSnapshot().intentions, before);
    assert.equal(proposals, uncertain ? 0 : 1);
  }
});

test('lifecycle suspension, reactivation, priority and abandonment use typed decisions', async () => {
  let selected = 'keep';
  const mind = createMind(planned(), provider(async (_url, init) => {
    const b = JSON.parse(init!.body as string); if (!b.questions) return chat(b.response_format.json_schema.name, b);
    const overrides: Record<string, any> = {};
    for (const [id, q] of Object.entries(b.questions) as [string, any][]) if (q.type === 'choice') overrides[id] = choice(Object.keys(q.criteria), selected);
    return Response.json(decisions(b.questions, overrides));
  }));
  await mind.ingest(observation()); const id = mind.getSnapshot().intentions![0]!.id;
  for (const [index, action] of ['suspend', 'reactivate', 'reprioritize', 'abandon'].entries()) {
    selected = action; await mind.ingest(observation(action, 100 * (index + 1)));
    const intention = mind.getSnapshot().intentions!.find(i => i.id === id)!;
    assert.equal(intention.status, action === 'suspend' ? 'suspended' : action === 'abandon' ? 'abandoned' : 'active');
    if (action === 'reprioritize') assert.equal(intention.priority, 0.75);
  }
});

test('Jev cannot be routed through appraisal or generative chat roles', () => {
  for (const model of ['typesafe/jev-1.13', '~typesafe/jev-latest', 'typesafe/jev']) {
    assert.throws(() => createOpenRouterProvider({ apiKey, model }));
    assert.throws(() => createOpenRouterProvider({ apiKey, model: 'chat', intentionGenerationModel: model }));
  }
});

test('HTTP and network failures redact diagnostics and roll back', async () => {
  for (const failure of [() => new Response(apiKey, { status: 429 }), () => { throw new Error(apiKey); }]) {
    const mind = createMind(planned(), provider(async (_url, init) => {
      const b = JSON.parse(init!.body as string); return b.questions ? failure() : chat(b.response_format.json_schema.name, b);
    }));
    const before = mind.exportRecording(); await assert.rejects(mind.ingest(observation()), e => !String(e).includes(apiKey));
    assert.deepEqual(mind.exportRecording(), before);
  }
});
