import test from 'node:test';
import assert from 'node:assert/strict';
import { createMind } from '../src/index.js';
import { createOpenRouterProvider } from '../src/providers/openrouter.js';
import { config, observation } from './helpers.js';

test('model requests omit runtime configuration and contain each observed event once', async () => {
  const sent: any[] = [];
  const provider = createOpenRouterProvider({ apiKey: 'test', model: 'test/model', fetch: async (_url, init) => {
    sent.push(JSON.parse(JSON.parse(String(init!.body)).messages[1].content));
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ beliefUpdates: [], moodDeltas: {}, emotionDeltas: {}, explanation: null }) } }] }));
  } });
  const c = config(); c.runId = 'private-run-id';
  const mind = createMind(c, provider);
  await mind.ingest({ ...observation('past'), content: 'past-event-marker' });
  await mind.ingest({ ...observation('current'), content: 'current-event-marker' });
  const wire = JSON.stringify(sent[1]);
  assert.equal(wire.includes('private-run-id'), false);
  assert.equal(wire.includes('halfLifeMs'), false);
  assert.equal(wire.includes('schemaVersion'), false);
  assert.equal(wire.includes('processing'), false);
  assert.equal(wire.split('current-event-marker').length - 1, 1);
  assert.equal(wire.split('past-event-marker').length - 1, 1);
  assert.equal(sent[1].mind.config.goal, c.goal);
  assert.equal(sent[1].mind.emotions.anger.value, 0);
});

