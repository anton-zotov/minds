import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMind, restoreMind, type ActionOpportunity, type CognitionProvider } from '../src/index.js';
import { config, proposal, observation } from './helpers.js';
const metadata = proposal().metadata;
test('sequential appraisal after actions preserves schema 8 and restorable inspection', async () => {
 const provider=fixture(); provider.stages={updateBeliefs:async()=>({beliefUpdates:[],metadata}),appraiseEmotions:async()=>({moodDeltas:{},emotionDeltas:{},metadata})};
 const mind=createMind(config(),provider); await mind.planAction(opportunity); await mind.ingest({...observation(),id:'speech',time:0});
 assert.equal(mind.getSnapshot().schemaVersion,8);
 assert.deepEqual(restoreMind(mind.exportCompactRecording(),provider).getSnapshot(),mind.getSnapshot());
 assert.doesNotThrow(()=>mind.getRecords());
});
const opportunity: ActionOpportunity = { id: 'turn', time: 0, capabilities: [{ id: 'say', description: 'Speak', targets: ['other'], parameters: [], expression: 'speech' }] };
function fixture(): CognitionProvider { return { appraise: async () => proposal(), actions: { generate: async () => ({ candidates: [{ id: 'c', capabilityId: 'say', targetId: 'other', intentionId: null, objective: 'Ask', parameters: {} }], metadata }), select: async () => ({ candidateId: 'c', scores: [{ candidateId: 'c', score: .8 }], metadata }), express: async () => ({ speech: 'Hello', metadata }) } }; }
test('actions are atomic, durable, idempotent transport without cognitive observation', async () => {
 const provider = fixture(); let calls = 0; const generate = provider.actions!.generate; provider.actions!.generate = async c => { calls++; return generate(c); };
 const mind = createMind(config(), provider); const result = await mind.planAction(opportunity); assert.equal(result.action?.expression, 'Hello'); assert.equal(result.snapshot.memories.length, 0); assert.equal(result.snapshot.schemaVersion, 8);
 assert.equal((await mind.planAction(opportunity)).duplicate, true); assert.equal(calls, 1);
 await mind.submitAction(result.action!.id); await mind.resolveAction({actionId:result.action!.id,status:'executed',reason:null});
 assert.equal((await mind.resolveAction({actionId:result.action!.id,status:'executed',reason:null})).duplicate,true);
 await assert.rejects(mind.resolveAction({actionId:result.action!.id,status:'rejected',reason:null}));
 await mind.ingest(observation()); assert.equal(mind.getSnapshot().schemaVersion,8); assert.equal(mind.exportCompactRecording().schemaVersion,9);
 const restored = restoreMind(mind.exportCompactRecording(), provider); assert.deepEqual(restored.exportRecording(),mind.exportRecording()); assert.equal((await restored.planAction(opportunity)).duplicate,true); assert.equal(calls,1);
 assert.deepEqual(restoreMind(mind.exportRecording(),provider).getSnapshot(), mind.getSnapshot());
});
test('expression failure commits nothing and explicit no action is cached',async()=>{
 const provider=fixture(); provider.actions!.express=async()=>{throw Error('offline');}; const mind=createMind(config(),provider); const before=mind.exportRecording(); await assert.rejects(mind.planAction(opportunity)); assert.deepEqual(mind.exportRecording(),before);
 provider.actions!.select=async()=>({candidateId:null,scores:[{candidateId:'c',score:0}],metadata}); const noAction={...opportunity,id:'no-action'}; assert.equal((await mind.planAction(noAction)).action,null); provider.actions!.generate=async()=>{throw Error('must not run');}; assert.equal((await mind.planAction(noAction)).duplicate,true);
});
test('strict capability and candidate permissions reject forged parameters and unknown targets',async()=>{
 const provider=fixture(); const mind=createMind(config(),provider); await assert.rejects(mind.planAction({...opportunity,time:1}));
 provider.actions!.generate=async()=>({candidates:[{id:'c',capabilityId:'say',targetId:'other',intentionId:null,objective:'Ask',parameters:{forged:1}}],metadata}); await assert.rejects(mind.planAction(opportunity)); assert.equal(mind.getRecordCount(),1);
});
test('concurrent opportunities serialize and capability descriptors enforce every parameter',async()=>{
 const provider=fixture(); let active=0;let maximum=0;
 provider.actions!.generate=async context=>{active++;maximum=Math.max(active,maximum);await new Promise(resolve=>setTimeout(resolve,5));active--;return {candidates:[{id:'c',capabilityId:'set',targetId:null,intentionId:null,objective:'Choose',parameters:{value:2,label:'yes'}}],metadata};};
 const op:ActionOpportunity={id:'one',time:0,capabilities:[{id:'set',description:'Choose a setting',targets:[],expression:'none',parameters:[{name:'value',type:'number',description:'Value',min:1,max:3},{name:'label',type:'string',description:'Label',enum:['yes','no']}]}]};const mind=createMind(config(),provider);
 const [a,b]=await Promise.all([mind.planAction(op),mind.planAction({...op,id:'two'})]);assert.equal(maximum,1);assert.notEqual(a.action!.id,b.action!.id);assert.equal(mind.getSnapshot().revision,2);
 const recording=mind.exportCompactRecording(); const bad=structuredClone(recording);const entry=bad.operations[0] as any;entry.generation.candidates[0].parameters.value=4;assert.throws(()=>restoreMind(bad,provider));
 const expanded=mind.exportRecording();(expanded.records[1]!.payload as any).input.opportunity.id='tampered';assert.throws(()=>restoreMind(expanded,provider));
 assert.deepEqual(restoreMind(recording,provider).exportRecording(),mind.exportRecording());
});
test('candidate pools, score coverage and speech boundaries reject without committing',async()=>{
 const provider=fixture();const mind=createMind(config(),provider);const generate=provider.actions!.generate;
 provider.actions!.generate=async c=>{const r=await generate(c);return {...r,candidates:Array.from({length:7},(_,i)=>({...r.candidates[0]!,id:String(i)}))};};await assert.rejects(mind.planAction(opportunity));
 provider.actions!.generate=generate;provider.actions!.select=async()=>({candidateId:'c',scores:[],metadata});await assert.rejects(mind.planAction(opportunity));
 provider.actions!.select=async()=>({candidateId:'c',scores:[{candidateId:'c',score:1}],metadata});provider.actions!.express=async()=>({speech:'a'.repeat(2001),metadata});await assert.rejects(mind.planAction(opportunity));assert.equal(mind.getRecordCount(),1);
});
test('lost submission receipts remain idempotent after terminal resolution and opportunities survive later clocks',async()=>{
 const provider=fixture();const mind=createMind(config(),provider);const action=(await mind.planAction(opportunity)).action!;await mind.submitAction(action.id);await mind.resolveAction({actionId:action.id,status:'rejected',reason:'host refused'});const before=mind.getSnapshot();assert.equal((await mind.submitAction(action.id)).duplicate,true);assert.deepEqual(mind.getSnapshot(),before);
 await mind.advanceTime(5);provider.actions!.generate=async()=>{throw Error('cached');};const cached=await mind.planAction(opportunity);assert.equal(cached.duplicate,true);assert.equal(cached.action!.status,'rejected');assert.equal(cached.snapshot.time,5);
});
test('schema 6 cognition continues through actions and evidence completion without schema downgrade',async()=>{
 const provider=fixture();provider.intentions={generate:async()=>({candidates:[{id:'goal',description:'Ask once',priority:1,supportingBeliefIds:[]}],metadata}),evaluate:async()=>({accept:true,scores:{goalAlignment:1,feasibility:1,emotionalCompatibility:1,novelty:1,compatibility:1},metadata}),sufficient:async()=>({sufficient:true,metadata}),reconsider:async()=>({revisions:[],generateMore:false,metadata})};
 const mind=createMind({...config(),intentionPolicy:{maxCandidates:6,maxEvaluations:6,maxActive:2,seed:1}},provider);await mind.ingest(observation());assert.equal(mind.getSnapshot().schemaVersion,6);const original=mind.exportCompactRecording();assert.equal(original.schemaVersion,7);
 await mind.planAction(opportunity);provider.intentions.reconsider=async context=>({revisions:[{intentionId:context.mind.intentions![0]!.id,action:'complete',evidenceIds:[context.observation.id]}],generateMore:false,metadata});await mind.ingest(observation('consequence',2));assert.equal(mind.getSnapshot().schemaVersion,8);assert.equal(mind.getSnapshot().intentions![0]!.status,'completed');assert.deepEqual(restoreMind(mind.exportCompactRecording(),provider).exportRecording(),mind.exportRecording());
});
test('failed expression retries preserve selected generation and selection until atomic commit',async()=>{
 const provider=fixture();let generations=0,selections=0,expressions=0;const generate=provider.actions!.generate,select=provider.actions!.select;
 provider.actions!.generate=async c=>{generations++;return generate(c);};provider.actions!.select=async c=>{selections++;return select(c);};provider.actions!.express=async()=>{if(++expressions===1)throw Error('expression offline');return {speech:'Retried wording',metadata};};
 const mind=createMind(config(),provider);const before=mind.exportRecording();await assert.rejects(mind.planAction(opportunity));assert.deepEqual(mind.exportRecording(),before);const planned=await mind.planAction(opportunity);assert.equal(planned.action!.expression,'Retried wording');assert.deepEqual([generations,selections,expressions],[1,1,2]);assert.equal(planned.records.filter(r=>(r.payload as any).stage==='action-generation').length,1);
});
test('selection failures retain a detached pool but committed cognition invalidates pending context',async()=>{
 const provider=fixture();let generations=0,selections=0;const generate=provider.actions!.generate;let returned:any;
 provider.actions!.generate=async c=>{generations++;returned=await generate(c);return returned;};provider.actions!.select=async c=>{if(++selections===1)throw Error('select offline');assert.equal(c.candidates[0]!.objective,'Ask');return {candidateId:'c',scores:[{candidateId:'c',score:1}],metadata};};
 const mind=createMind(config(),provider);await assert.rejects(mind.planAction(opportunity));returned.candidates[0].objective='mutated externally';await mind.planAction(opportunity);assert.deepEqual([generations,selections],[1,2]);
 provider.actions!.express=async()=>{throw Error('speech offline');};await assert.rejects(mind.planAction({...opportunity,id:'next'}));assert.equal(generations,2);await mind.ingest(observation('changed'));provider.actions!.express=async()=>({speech:'Fresh context',metadata});await mind.planAction({...opportunity,id:'next'});assert.equal(generations,3);
});

