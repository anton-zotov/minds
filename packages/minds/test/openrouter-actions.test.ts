import test from 'node:test';
import assert from 'node:assert/strict';
import { createMind } from '../src/index.js';
import { createOpenRouterProvider } from '../src/providers/openrouter.js';
import { config, passive } from './helpers.js';
const key = 'action-secret-test-key';
function context(): any {
  const c = config(); c.goal = 'Buy cheaply; private ceiling is eight coins.';
  return { mind: createMind(c, passive).getSnapshot(), memories: [], opportunity: { id: 'turn-1', time: 0, capabilities: [
    { id: 'offer', description: 'Make an offer for one crate.', targets: ['ivo'], expression: 'speech', parameters: [{ name: 'price', type: 'number', description: 'Coins', min: 1, max: 20 }] },
  ] } };
}
const candidate = { id: 'offer-a', capabilityId: 'offer', targetId: 'ivo', intentionId: null, objective: 'Offer four coins and invite a counteroffer.', parameters: { price: 4 } };

test('action schema accepts quoted durable intention IDs without unsupported strict enums', async () => {
  const c = context();
  const id = JSON.stringify(['intention', 'run', 'marta', 'trade']);
  c.mind.intentions = [{ id, status: 'active' }];
  const actions = createOpenRouterProvider({apiKey:key,model:'generator',actions:true,fetch:async (_url,init) => {
    const schema = JSON.parse(String(init!.body)).response_format.json_schema.schema;
    const intention = schema.properties.candidates.items.anyOf[0].properties.intentionId;
    assert.equal(Object.hasOwn(intention, 'enum'), false, 'strict output rejects quoted IDs in enum literals');
    assert.deepEqual(schema.properties.candidates.items.anyOf[0].properties.capabilityId.enum,['offer']);
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({candidates:[{...candidate,intentionId:id}],explanation:null})}}]});
  }}).actions!;
  assert.equal((await actions.generate(c)).candidates[0]!.intentionId,id);
});

test('speech evidence IDs remain valid in belief proposals without quote-bearing schema enums', async () => {
  const c = context();
  const observation = {id:JSON.stringify(['action','run','marta','turn'])+'-speech-0',time:0,source:'marta',kind:'speech',content:'Would you accept four coins?'};
  c.observation=observation; c.memories=[{id:observation.id,observation}];
  const provider=createOpenRouterProvider({apiKey:key,model:'generator',appraisalDecisionModel:'typesafe/jev-1.13',fetch:async(_url,init)=>{
    const schema=JSON.parse(String(init!.body)).response_format.json_schema.schema;
    assert.equal(Object.hasOwn(schema.properties.candidates.items.properties.evidenceIds.items,'enum'),false);
    return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({candidates:[],explanation:null})}}]});
  }});
  assert.deepEqual((await provider.stages!.updateBeliefs(c)).beliefUpdates,[]);
});

test('action proposals, Jev choice and speech use separate models with lean subjective context', async () => {
  const requests: any[] = [];
  const provider = createOpenRouterProvider({ apiKey: key, model: 'appraisal', actions: true,
    actionGenerationModel: 'generator', actionDecisionModel: 'typesafe/jev-1.13', actionExpressionModel: 'speaker',
    fetch: async (url: any, init: any) => {
      const body = JSON.parse(init.body); requests.push(body);
      if (String(url).endsWith('/decisions')) return Response.json({ model: 'typesafe/jev-1.13', usage: {}, answers: Object.fromEntries(Object.entries(body.questions).map(([id, q]: any) => [id, q.type === 'score'
        ? { type: 'score', score: 3, probabilities: { 0: 0, 1: 0, 2: 0, 3: 1, 4: 0 } }
        : { type: 'choice', choice: 'candidate_0', probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === 'candidate_0' ? 1 : 0])) }])) });
      const name = body.response_format.json_schema.name;
      const output = name === 'mind_action_generation' ? { candidates: [candidate], explanation: null } : { speech: 'Would you take four coins for the crate?', explanation: null };
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }], model: body.model });
    } } as any);
  assert.ok((provider as any).actions, 'actions must be installed when enabled');
  const actions = (provider as any).actions; const c = context();
  const generated = await actions.generate(c); const selected = await actions.select({ ...c, candidates: generated.candidates });
  assert.equal(selected.candidateId, candidate.id); assert.equal(selected.scores[0].score, 0.75);
  const expression = await actions.express({ ...c, candidate }); assert.match(expression.speech, /four coins/);
  assert.deepEqual(requests.map(r => r.model), ['generator', 'typesafe/jev-1.13', 'speaker']);
  for (const request of requests) {
    const wire = JSON.stringify(request.state?.context ?? JSON.parse(request.messages[1].content));
    assert.equal(wire.includes('run-1'), false); assert.equal(wire.includes('halfLifeMs'), false);
    assert.equal(wire.includes('schemaVersion'), false); assert.equal(wire.includes('"observation"'), false);
    assert.equal(wire.includes('private ceiling'), true); assert.equal(wire.includes('seller secret'), false);
  }
});

test('an empty action pool explicitly selects no action without inference', async () => {
  let calls = 0;
  const provider = createOpenRouterProvider({ apiKey: key, model: 'generator', actions: true, actionDecisionModel: 'typesafe/jev-1.13', fetch: async () => { calls++; throw new Error('must not infer'); } } as any);
  assert.ok((provider as any).actions);
  const selected = await (provider as any).actions.select({ ...context(), candidates: [] });
  assert.equal(selected.candidateId, null); assert.deepEqual(selected.scores, []); assert.equal(calls, 0);
});

test('Jev can select no action from a nonempty pool', async () => {
  const provider = createOpenRouterProvider({ apiKey: key, model: 'generator', actions: true, actionDecisionModel: 'typesafe/jev-1.13', fetch: async (_url, init) => {
    const body = JSON.parse(String(init!.body));
    return Response.json({ model: 'typesafe/jev-1.13', usage: {}, answers: Object.fromEntries(Object.entries(body.questions).map(([id, q]: any) => [id, q.type === 'score'
      ? { type: 'score', score: 0, probabilities: { 0: 1, 1: 0, 2: 0, 3: 0, 4: 0 } }
      : { type: 'choice', choice: 'no_action', probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === 'no_action' ? 1 : 0])) }])) });
  } });
  const selected = await provider.actions!.select({ ...context(), candidates: [candidate] });
  assert.equal(selected.candidateId, null); assert.equal(selected.scores[0]!.score, 0);
});

test('malformed generated action parameters fail without consuming the opportunity', async () => {
  for (const invalid of [{ ...candidate, capabilityId: 'invented' }, { ...candidate, parameters: { price: 100 } }, { ...candidate, targetId: 'secret-other-person' }, { ...candidate, intentionId: 'unknown' }]) {
    const provider = createOpenRouterProvider({ apiKey: key, model: 'generator', actions: true, fetch: async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ candidates: [invalid], explanation: null }) } }] }) });
    const mind = createMind(config(), provider); const before = mind.exportCompactRecording();
    await assert.rejects(mind.planAction(context().opportunity)); assert.deepEqual(mind.exportCompactRecording(), before);
  }
});
