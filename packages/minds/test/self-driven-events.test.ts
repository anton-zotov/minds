import test from 'node:test';
import assert from 'node:assert/strict';
import { createMind, restoreMind, type Observation } from '../src/index.js';
import { config, proposal } from './helpers.js';
import { readFile } from 'node:fs/promises';
import { createOpenRouterProvider } from '../src/providers/openrouter.js';
const event = (id = 'event', time = 0): Observation => ({ id, time, source: 'neighbor', kind: 'speech', content: 'The neighbor says access is restored.' });

test('plain observations enter cognition; host interpretation and completion controls are rejected', async () => {
  let calls = 0;
  const mind = createMind(config(), { appraise: async c => { calls++; assert.deepEqual(Object.keys(c.observation).sort(), ['content', 'id', 'kind', 'source', 'time']); return proposal(); } });
  await mind.ingest(event()); assert.equal(calls, 1); assert.equal(mind.getSnapshot().schemaVersion, 6);
  for (const extra of [{ processing: 'memoryOnly' }, { provenance: 'witnessed' }, { intentionCompletions: ['anything'] }]) {
    await assert.rejects(mind.ingest({ ...event('rejected'), ...extra } as any));
  }
  assert.equal(calls, 1); assert.equal(mind.getSnapshot().memories.length, 1);
});

test('expanded legacy versions 1–4 and journal 5 preserve historical controls only in replay', async () => {
  const fixtures = JSON.parse(await readFile('packages/minds/test/fixtures/legacy-events.json', 'utf8'));
  const offline = async () => { throw new Error('replay called inference'); };
  const unavailable: any = { appraise: offline, intentions: { generate: offline, reconsider: offline, sufficient: offline, evaluate: offline } };
  for (const fixture of fixtures) {
    assert.equal(fixture.expanded.schemaVersion, fixture.version); assert.equal(fixture.compact.schemaVersion, 5);
    for (const recording of [fixture.expanded, fixture.compact]) {
      const mind = restoreMind(recording, unavailable);
      assert.deepEqual(mind.exportRecording(), fixture.expanded);
      assert.deepEqual(mind.exportCompactRecording(), fixture.compact);
      await assert.rejects(mind.ingest(recording === fixture.expanded ? fixture.expanded.snapshot.memories[0].observation : fixture.compact.operations[0].observation));
      const continuation: any = { appraise: async () => proposal(), intentions: {
        generate: async () => ({ candidates: [], metadata: proposal().metadata }),
        reconsider: async () => ({ revisions: [], generateMore: false, metadata: proposal().metadata }),
        evaluate: offline, sufficient: offline,
      } };
      const continued = restoreMind(recording, continuation); await continued.ingest(event('new-event', 300));
      assert.equal(continued.getSnapshot().schemaVersion, 6); assert.equal(continued.exportCompactRecording().schemaVersion, 7);
      assert.deepEqual(continued.getRecords().slice(0, fixture.expanded.records.length), fixture.expanded.records);
      assert.deepEqual(restoreMind(continued.exportCompactRecording(), unavailable).exportRecording(), continued.exportRecording());
      assert.deepEqual(restoreMind(continued.exportRecording(), unavailable).exportRecording(), continued.exportRecording());
    }
  }
});

test('Jev completes strategies at its evidence-linked judgment threshold and preserves them below it', async () => {
  for (const probability of [0.64, 0.65]) {
    const requests: any[] = [];
    const provider = createOpenRouterProvider({ apiKey: 'secret-for-completion-test', model: 'generation/model', intentions: true,
      intentionDecisionModel: 'typesafe/jev-1.13', fetch: async (url, init) => {
        const body = JSON.parse(String(init!.body)); requests.push(body);
        if (String(url).endsWith('/decisions')) {
          const answers = Object.fromEntries(Object.entries(body.questions).map(([id, raw]) => {
            const q = raw as any;
            if (q.type === 'choice') return [id, { type: 'choice', choice: 'complete', confidence: probability,
              probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === 'complete' ? probability : k === 'keep' ? 1 - probability : 0])) }];
            if (q.type === 'score') return [id, { type: 'score', score: 3, confidence: 1, probabilities: { 0: 0, 1: 0, 2: 0, 3: 1, 4: 0 } }];
            return [id, { type: 'noul', noul: id === 'generate_more' ? 0 : 1 }];
          }));
          return Response.json({ model: 'typesafe/jev-1.13', answers, usage: {} });
        }
        const name = body.response_format.json_schema.name;
        const output = name === 'mind_appraisal' ? { beliefUpdates: [], moodDeltas: {}, emotionDeltas: {}, explanation: null }
          : { candidates: [{ id: 'ask', description: 'Ask for access', priority: 0.7, supportingBeliefIds: [] }], explanation: null };
        return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] });
      } });
    const mind = createMind({ ...config(), intentionPolicy: { maxCandidates: 2, maxEvaluations: 2, maxActive: 2, seed: 42 } }, provider);
    await mind.ingest(event('initial')); await mind.ingest(event('outcome', 100));
    assert.equal(mind.getSnapshot().intentions![0]!.status, probability >= 0.65 ? 'completed' : 'active');
    if (probability >= 0.65) assert.deepEqual(mind.getSnapshot().intentions![0]!.evidenceIds, ['outcome']);
    const judgment = requests.find(r => r.questions?.intention_0);
    assert.ok(judgment.questions.intention_0.criteria.complete);
    const wire = JSON.stringify(judgment.state.context);
    for (const field of ['provenance', 'processing', 'intentionCompletions']) assert.equal(wire.includes(`"${field}"`), false);
    assert.equal(requests.filter(r => r.response_format?.json_schema.name === 'mind_intention_generation').length, 1);
  }
});

test('elapsed time is remembered and reaches cognition after decay; no-op and failed clocks are atomic', async () => {
  let fail = false; let calls = 0;
  const c = config(); c.emotions.anger!.value = 1;
  const mind = createMind(c, { appraise: async context => {
    calls++; assert.equal(context.observation.kind, 'elapsed-time'); assert.equal(context.mind.emotions.anger!.value, 0.5);
    assert.match(context.observation.content, /1000/); if (fail) throw new Error('clock failed'); return proposal();
  } });
  const initial = mind.exportCompactRecording(); await mind.advanceTime(0); assert.deepEqual(mind.exportCompactRecording(), initial);
  fail = true; await assert.rejects(mind.advanceTime(1000), /clock failed/); assert.deepEqual(mind.exportCompactRecording(), initial);
  fail = false; await mind.advanceTime(1000); assert.equal(calls, 2);
  assert.equal(mind.getSnapshot().memories[0]!.observation.kind, 'elapsed-time');
  assert.equal(mind.exportCompactRecording().schemaVersion, 7);
  assert.deepEqual(restoreMind(mind.exportCompactRecording(), { appraise: async () => { throw new Error('offline'); } }).exportRecording(), mind.exportRecording());
});


