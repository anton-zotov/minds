import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMind, restoreMind } from '../src/index.js';
import { createOpenRouterProvider } from '../src/providers/openrouter.js';
import { config, observation } from './helpers.js';
const key = 'planning-test-secret';
const planned = () => ({ ...config(), intentionPolicy: { maxCandidates: 6, maxEvaluations: 6, maxActive: 3, seed: 42 } });
function completion(output: unknown) { return Response.json({ model: 'resolved-model', id: 'generation-test', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }], usage: { total_tokens: 123, cost: 0.001 } }); }
function output(name: string): any {
  if (name === 'mind_appraisal') return { beliefUpdates: [], moodDeltas: {}, emotionDeltas: { anger: 0.2 }, explanation: 'Appraise' };
  if (name === 'mind_intention_generation') return { candidates: [{ id: 'a', description: 'Negotiate access', priority: 0.8, supportingBeliefIds: [] }], explanation: 'Generate' };
  if (name === 'mind_intention_evaluation') return { accept: true, scores: { goalAlignment: 0.9, feasibility: 0.8, emotionalCompatibility: 0.7, novelty: 0.8, compatibility: 0.9 }, explanation: 'Evaluate' };
  if (name === 'mind_intention_sufficiency') return { sufficient: true, explanation: 'Enough' };
  return { revisions: [], generateMore: false, explanation: 'Retain commitment' };
}

test('OpenRouter planning routes separate roles and records sanitized actual inputs, outputs and usage', async () => {
  const sent: any[] = [];
  const provider = createOpenRouterProvider({ apiKey: key, model: 'appraisal', intentions: true, intentionGenerationModel: 'generator', intentionDecisionModel: 'judge',
    fetch: async (_url: any, init: any) => { const request = JSON.parse(init.body); sent.push(request); return completion(output(request.response_format.json_schema.name)); } } as any);
  const mind = createMind(planned(), provider); await mind.ingest(observation()); await mind.ingest(observation('next', 100));
  assert.deepEqual(sent.map(r => r.model), ['appraisal', 'generator', 'judge', 'judge', 'appraisal', 'judge']);
  assert.deepEqual(sent.map(r => r.response_format.json_schema.name), ['mind_appraisal', 'mind_intention_generation', 'mind_intention_evaluation', 'mind_intention_sufficiency', 'mind_appraisal', 'mind_intention_reconsideration']);
  assert.equal(JSON.parse(sent[2].messages[1].content).mind.emotions.anger.value, 0.2);
  const call = mind.getRecords().find(r => (r.payload as any)?.stage === 'intention-generation')!.payload as any;
  assert.equal(call.result.metadata.model, 'resolved-model'); assert.equal(call.result.metadata.parameters.usage.total_tokens, 123);
  assert.equal(call.result.metadata.parameters.request.model, 'generator');
  assert.equal(JSON.parse(call.result.metadata.parameters.response.choices[0].message.content).candidates[0].description, 'Negotiate access');
  assert.deepEqual(restoreMind(mind.exportRecording(), provider).getSnapshot(), mind.getSnapshot());
  assert.equal(JSON.stringify(mind.exportRecording()).includes(key), false);
});

test('invalid planning responses fail without committing earlier appraisal or consuming the observation', async () => {
  for (const invalid of [{ candidates: [{ id: 'a', description: 'Invented', priority: 2, supportingBeliefIds: [] }], explanation: null },
    { candidates: [], extra: 'unsupported', explanation: null }, { candidates: [{ id: 'a', description: 'Hidden', priority: 0.5, supportingBeliefIds: ['hidden'] }], explanation: null }]) {
    const mind = createMind(planned(), createOpenRouterProvider({ apiKey: key, model: 'test', intentions: true,
      fetch: async (_url: any, init: any) => { const name = JSON.parse(init.body).response_format.json_schema.name; return completion(name === 'mind_appraisal' ? output(name) : invalid); } } as any));
    const before = mind.exportRecording(); await assert.rejects(mind.ingest(observation())); assert.deepEqual(mind.exportRecording(), before);
  }
});

test('planning responses redact escaped secret echoes and timeout aborts the entire event', async () => {
  const escaped = [...key].map(char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  const provider = createOpenRouterProvider({ apiKey: key, model: 'test', intentions: true,
    fetch: async (_url: any, init: any) => {
      const data = output(JSON.parse(init.body).response_format.json_schema.name); data.explanation = key;
      const response = await completion(data).json(); response.choices[0].message.content = response.choices[0].message.content.replace(key, escaped); return Response.json(response);
    } } as any);
  const mind = createMind(planned(), provider); await mind.ingest(observation());
  const decision = mind.getRecords().find(r => (r.payload as any)?.stage === 'intention-generation')!.payload as any;
  assert.equal(JSON.parse(decision.result.metadata.parameters.response.choices[0].message.content).explanation, '[REDACTED]');
  assert.equal(JSON.stringify(mind.exportRecording()).includes(key), false);
  let aborted = false;
  const timeout = createMind(planned(), createOpenRouterProvider({ apiKey: key, model: 'test', intentions: true, timeoutMs: 10,
    fetch: async (_url: any, init: any) => {
      const name = JSON.parse(init.body).response_format.json_schema.name;
      if (name === 'mind_appraisal') return completion(output(name));
      return new Promise((_r, reject) => init.signal.addEventListener('abort', () => { aborted = true; reject(new Error(key)); }));
    } } as any));
  const before = timeout.exportRecording(); await assert.rejects(timeout.ingest(observation()), (e: any) => e.code === 'timeout' && !String(e).includes(key));
  assert.equal(aborted, true); assert.deepEqual(timeout.exportRecording(), before);
});

test('planning wire schemas use the documented strict-output keyword subset and local uniqueness still rejects duplicates', async () => {
  const schemas: unknown[] = [];
  const provider = createOpenRouterProvider({ apiKey: key, model: 'test', intentions: true,
    fetch: async (_url: any, init: any) => { const request = JSON.parse(init.body); if (request.response_format.json_schema.name !== 'mind_appraisal') schemas.push(request.response_format.json_schema.schema); return completion(output(request.response_format.json_schema.name)); } } as any);
  const mind = createMind(planned(), provider); await mind.ingest(observation()); await mind.ingest(observation('next', 100));
  function check(value: unknown) {
    if (!value || typeof value !== 'object') return;
    assert.equal(Object.hasOwn(value, 'uniqueItems'), false, 'uniqueItems is unsupported by strict outputs');
    assert.equal(Object.hasOwn(value, 'minLength'), false, 'keep nonempty validation local for cross-provider compatibility');
    for (const item of Object.values(value)) check(item);
  }
  schemas.forEach(check);
  const invalid = createMind(planned(), createOpenRouterProvider({ apiKey: key, model: 'test', intentions: true,
    fetch: async (_url: any, init: any) => { const name = JSON.parse(init.body).response_format.json_schema.name; const result = output(name);
      if (name === 'mind_intention_generation') result.candidates[0].supportingBeliefIds = ['b', 'b'];
      if (name === 'mind_appraisal') result.beliefUpdates = [{ id: 'b', statement: 'Known', confidence: 0.5, evidenceIds: [] }];
      return completion(result); } } as any));
  await assert.rejects(invalid.ingest(observation())); assert.equal(invalid.getSnapshot().revision, 0);
});
