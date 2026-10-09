import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiServer } from '../server/api.ts';
import { createFixtureProvider } from '../server/scenario.ts';
import { restoreMind } from '@minds/core';

async function running(options: Parameters<typeof createApiServer>[0], fn: (url: string) => Promise<void>) {
  const server = createApiServer(options); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  try { await fn(`http://127.0.0.1:${address.port}`); } finally { await new Promise<void>((r, j) => server.close(e => e ? j(e) : r())); }
}
test('API validates bodies, protects provider configuration and exports compatible envelopes', async () => {
  await running({ env: {} }, async url => {
    assert.equal((await (await fetch(`${url}/api/run`)).json()).providerMode, 'fixture');
    for (const body of ['bad json', '{"mode":"unknown"}', '{"mode":"openrouter"}']) {
      const r = await fetch(`${url}/api/run`, { method: 'POST', body }); assert.equal(r.status, 400);
    }
    const bad = await fetch(`${url}/api/inject`, { method: 'POST', body: '{}' }); assert.equal(bad.status, 400);
    for (const field of ['processing', 'provenance', 'intentionCompletions']) {
      const rejected = await fetch(`${url}/api/inject`, { method: 'POST', body: JSON.stringify({ content: 'The agreement is signed.', recipients: ['marta'], [field]: field === 'intentionCompletions' ? ['unknown'] : 'reported' }) });
      assert.equal(rejected.status, 400);
      assert.equal((await (await fetch(`${url}/api/run`)).json()).minds[0].snapshot.revision, 0);
    }
    await fetch(`${url}/api/step`, { method: 'POST' });
    const exported = await (await fetch(`${url}/api/recording`)).json();
    assert.equal(exported.schemaVersion, 1); assert.equal(exported.minds.length, 2); assert.equal(exported.world.transcript.length, 1);
    const compact = await (await fetch(`${url}/api/recording?format=compact`)).json();
    assert.equal(compact.schemaVersion, 2); assert.equal(compact.minds[0].schemaVersion, 9);
    assert.deepEqual(restoreMind(compact.minds[0], createFixtureProvider()).exportRecording(), exported.minds[0]);
    const status = await (await fetch(`${url}/api/status`)).json();
    assert.equal(status.status, 'ready'); assert.equal(status.recordCounts[0], exported.minds[0].records.length);
    assert.equal(Object.hasOwn(status, 'minds'), false);
  });
});
test('pending reset is rejected and provider failures do not leak error bodies', async () => {
  let release!: () => void; const wait = new Promise<void>(r => { release = r; });
  await running({ env: {}, providerFactory: () => ({ appraise: async () => { await wait; throw new Error('SECRET_SENTINEL'); } }) }, async url => {
    const step = fetch(`${url}/api/step`, { method: 'POST' });
    for (let i = 0; i < 50; i++) {
      if ((await (await fetch(`${url}/api/run`)).json()).status === 'pending') break;
      await new Promise(r => setTimeout(r, 5));
    }
    const reset = await fetch(`${url}/api/run`, { method: 'POST', body: '{"mode":"fixture"}' });
    assert.equal(reset.status, 409); release();
    const view = await (await step).json(); assert.equal(view.status, 'failed');
    assert.equal(JSON.stringify(view).includes('SECRET_SENTINEL'), false);
  });
});
test('configured server exposes model availability without credentials', async () => {
  await running({ env: { OPENROUTER_API_KEY: 'SECRET_SENTINEL', OPENROUTER_APPRAISAL_MODEL: 'model-id' }, providerFactory: createFixtureProvider }, async url => {
    const text = await (await fetch(`${url}/api/config`)).text(); assert.ok(text.includes('model-id')); assert.ok(!text.includes('SECRET_SENTINEL'));
  });
});

test('Playbox chooses Jev decisions by default and honors role overrides', async () => {
  for (const [extra, model, endpoint] of [
    [{}, 'typesafe/jev-1.13', 'decisions'],
    [{ OPENROUTER_DECISION_MODEL: 'typesafe/jev-1.12' }, 'typesafe/jev-1.12', 'decisions'],
    [{ OPENROUTER_DECISION_MODEL: 'typesafe/jev-1.13', OPENROUTER_INTENTION_DECISION_MODEL: 'chat-model' }, 'chat-model', 'chat/completions'],
  ] as const) {
    await running({ env: { OPENROUTER_API_KEY: 'SECRET_SENTINEL', OPENROUTER_APPRAISAL_MODEL: 'appraisal', ...extra }, providerFactory: createFixtureProvider }, async url => {
      const config = await (await fetch(`${url}/api/config`)).json(); assert.equal(config.intentionDecisionModel, model); assert.equal(config.intentionDecisionEndpoint, endpoint);
      assert.equal(config.appraisalDecisionModel, extra.OPENROUTER_DECISION_MODEL ?? 'typesafe/jev-1.13');
    });
  }
});

test('appraisal inherits the effective Jev model while explicit overrides stay independent', async () => {
  for (const [extra, expected] of [
    [{ OPENROUTER_INTENTION_DECISION_MODEL: 'typesafe/jev-1.12' }, 'typesafe/jev-1.12'],
    [{ OPENROUTER_INTENTION_DECISION_MODEL: 'typesafe/jev-1.12', OPENROUTER_APPRAISAL_DECISION_MODEL: 'typesafe/jev-1.13' }, 'typesafe/jev-1.13'],
    [{ OPENROUTER_INTENTION_DECISION_MODEL: 'chat', OPENROUTER_DECISION_MODEL: 'chat' }, 'typesafe/jev-1.13'],
  ] as const) await running({ env: { OPENROUTER_API_KEY: 'test', OPENROUTER_APPRAISAL_MODEL: 'luna', ...extra }, providerFactory: createFixtureProvider }, async url => {
    const settings = await (await fetch(`${url}/api/config`)).json(); assert.equal(settings.appraisalDecisionModel, expected);
  });
});


test('conversation endpoint and reset export fresh world with both journals',async()=>{await running({env:{}},async url=>{const v=await(await fetch(`${url}/api/conversation`,{method:'POST'})).json();assert.equal(v.world.transaction.price,7);assert.equal(v.minds.length,2);assert.equal(v.world.transcript.length,3);const reset=await(await fetch(`${url}/api/run`,{method:'POST',body:'{"mode":"fixture"}'})).json();assert.equal(reset.world.transaction,null);assert.equal(reset.world.transcript.length,0);assert.deepEqual(reset.world.balances,{marta:10,ivo:0});});});
test('action model roles honor independent overrides without exposing credentials',async()=>{await running({env:{OPENROUTER_API_KEY:'SECRET',OPENROUTER_APPRAISAL_MODEL:'appraisal',OPENROUTER_ACTION_GENERATION_MODEL:'action-generate',OPENROUTER_ACTION_DECISION_MODEL:'typesafe/jev-1.13',OPENROUTER_ACTION_EXPRESSION_MODEL:'speech'},providerFactory:createFixtureProvider},async url=>{const c=await(await fetch(`${url}/api/config`)).json();assert.equal(c.actionGenerationModel,'action-generate');assert.equal(c.actionDecisionModel,'typesafe/jev-1.13');assert.equal(c.actionExpressionModel,'speech');assert.equal(JSON.stringify(c).includes('SECRET'),false);});});
