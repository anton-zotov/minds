import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMind } from '../src/index.js';
import { createOpenRouterProvider } from '../src/providers/openrouter.js';
import { config, observation } from './helpers.js';
const key = 'secret-key-for-tests';
function body(explanation: string | null = null) {
  return { beliefUpdates: [{ id: 'b', statement: 'Ally is unreliable', confidence: 0.7, evidenceIds: ['event-1'] }],
    moodDeltas: { calm: -0.1 }, emotionDeltas: { anger: 0.2 }, explanation };
}
function response(content = JSON.stringify(body())) {
  return { id: 'generation-1', model: 'vendor/resolved', choices: [{ message: { content }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } };
}
test('OpenRouter requests structured appraisal and records non-secret actual metadata', async () => {
  let requests = 0;
  const fetcher: typeof fetch = async (url, init) => {
    requests++; assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions'); assert.equal(init!.method, 'POST');
    assert.equal(new Headers(init!.headers).get('Authorization'), `Bearer ${key}`);
    const sent = JSON.parse(init!.body as string);
    assert.equal(sent.model, 'vendor/chosen'); assert.equal(sent.stream, false); assert.equal(sent.provider.require_parameters, true);
    assert.equal(Object.hasOwn(sent, 'temperature'), false);
    assert.equal(sent.response_format.type, 'json_schema'); assert.equal(sent.response_format.json_schema.strict, true);
    assert.equal(JSON.stringify(sent).includes(key), false);
    const context = JSON.parse(sent.messages[1].content); assert.equal(context.observation.id, 'event-1'); assert.equal(context.mind.config.identity.name, 'alice');
    assert.equal(Object.hasOwn(context, 'worldFacts'), false);
    return Response.json(response());
  };
  const mind = createMind(config(), createOpenRouterProvider({ apiKey: key, model: 'vendor/chosen', fetch: fetcher }));
  await mind.ingest(observation()); assert.equal(requests, 1); assert.equal(mind.getSnapshot().beliefs[0]!.confidence, 0.7);
  const decision = mind.getRecords().find(record => record.type === 'decision')!.payload as any;
  assert.equal(decision.proposal.metadata.model, 'vendor/resolved');
  assert.equal(decision.proposal.metadata.parameters.usage.total_tokens, 120);
  const diagnostics = decision.proposal.metadata.parameters;
  assert.equal(diagnostics.request.model, 'vendor/chosen');
  assert.equal(diagnostics.request.messages[0].role, 'system');
  assert.equal(JSON.parse(diagnostics.request.messages[1].content).observation.id, 'event-1');
  assert.equal(diagnostics.response.model, 'vendor/resolved');
  assert.equal(JSON.parse(diagnostics.response.choices[0].message.content).emotionDeltas.anger, 0.2);
  assert.equal(JSON.stringify(mind.exportRecording()).includes(key), false);
});
test('explicit sampling settings are forwarded when the host chooses to supply them', async () => {
  const mind = createMind(config(), createOpenRouterProvider({ apiKey: key, model: 'sampling-capable-model', temperature: 0.3,
    fetch: async (_url, init) => { assert.equal(JSON.parse(init!.body as string).temperature, 0.3); return Response.json(response()); } }));
  await mind.ingest(observation());
});
test('HTTP failures and echoed credentials are sanitized without retry or state change', async () => {
  for (const status of [401, 429, 500]) {
    let calls = 0;
    const provider = createOpenRouterProvider({ apiKey: key, model: 'test', fetch: async () => { calls++; return Response.json({ error: { message: key } }, { status }); } });
    const mind = createMind(config(), provider); const before = mind.exportRecording();
    await assert.rejects(mind.ingest(observation()), error => {
      assert.equal(String(error).includes(key), false); assert.equal((error as any).status, status); return true;
    });
    assert.equal(calls, 1); assert.deepEqual(mind.exportRecording(), before);
  }
});
test('invalid output, error envelopes, and truncated completions fail atomically', async () => {
  const responses = [
    { error: { message: key } }, { choices: [] }, response('not-json'),
    { ...response(), choices: [{ message: { content: JSON.stringify(body()) }, finish_reason: 'length' }] },
    response(JSON.stringify({ ...body(), emotionDeltas: { unknown: 0.2 } })),
    response(JSON.stringify({ ...body(), beliefUpdates: [{ id: 'b', statement: 'Claim', confidence: 0.5, evidenceIds: ['foreign'] }] })),
  ];
  for (const value of responses) {
    const mind = createMind(config(), createOpenRouterProvider({ apiKey: key, model: 'test', fetch: async () => Response.json(value) }));
    const before = mind.exportRecording(); await assert.rejects(mind.ingest(observation())); assert.deepEqual(mind.exportRecording(), before);
  }
});
test('timeouts abort the HTTP call and do not commit observations', async () => {
  let aborted = false;
  const fetcher: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener('abort', () => { aborted = true; reject(new Error(key)); }, { once: true });
  });
  const mind = createMind(config(), createOpenRouterProvider({ apiKey: key, model: 'test', fetch: fetcher, timeoutMs: 10 }));
  await assert.rejects(mind.ingest(observation()), error => { assert.equal((error as any).code, 'timeout'); assert.equal(String(error).includes(key), false); return true; });
  assert.equal(aborted, true); assert.equal(mind.getSnapshot().revision, 0);
});
test('successful responses cannot echo credentials into cognitive state or traces', async () => {
  const payload = body(key); payload.beliefUpdates[0]!.statement = `Echo ${key}`;
  const mind = createMind(config(), createOpenRouterProvider({ apiKey: key, model: 'test', fetch: async () => Response.json(response(JSON.stringify(payload))) }));
  await mind.ingest(observation()); assert.equal(JSON.stringify(mind.exportRecording()).includes(key), false);
});
test('recorded completion content cannot retain JSON-escaped credentials', async () => {
  const escaped = [...key].map(char => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  const content = JSON.stringify(body(key)).replace(key, escaped);
  const mind = createMind(config(), createOpenRouterProvider({ apiKey: key, model: 'test', fetch: async () => Response.json(response(content)) }));
  await mind.ingest(observation());
  const decision = mind.getRecords().find(r => r.type === 'decision')!.payload as any;
  const recorded = JSON.parse(decision.proposal.metadata.parameters.response.choices[0].message.content);
  assert.equal(recorded.explanation, '[REDACTED]');
});
test('invalid provider settings fail before any inference', () => {
  for (const options of [{ apiKey: '', model: 'm' }, { apiKey: key, model: '' }, { apiKey: key, model: 'm', timeoutMs: 0 },
    { apiKey: key, model: 'm', maxTokens: 1.5 }, { apiKey: key, model: 'm', temperature: NaN }]) {
    assert.throws(() => createOpenRouterProvider(options));
  }
});

