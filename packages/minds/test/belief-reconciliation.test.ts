import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMind,restoreMind} from '../src/index.js';
import {config,proposal,observation} from './helpers.js';
import {createOpenRouterProvider} from '../src/providers/openrouter.js';
const metadata=proposal().metadata;
function character(){return {...config(),beliefs:[{id:'balance',statement:'I have 10 coins.',confidence:1,evidenceIds:[]},{id:'offer',statement:'An offer is pending.',confidence:.9,evidenceIds:[]}]};}
function reconciled(){return {beliefUpdates:[{id:'balance',statement:'I have 3 coins and one crate.',confidence:.93,evidenceIds:['event-1']}],beliefRetirements:[{id:'offer',evidenceIds:['event-1'],supersededBy:'balance'}],metadata};}
test('belief reconciliation revises stable identity and retires stale beliefs before affect; replay preserves history',async()=>{
 const provider:any={appraise:async()=>proposal(),stages:{updateBeliefs:async()=>reconciled(),appraiseEmotions:async(c:any)=>{assert.deepEqual(c.mind.beliefs.map((b:any)=>b.id),['balance']);return {moodDeltas:{},emotionDeltas:{},metadata};}}};
 const mind=createMind(character(),provider);await mind.ingest(observation());assert.equal(mind.getSnapshot().beliefs.length,1);assert.equal(mind.getSnapshot().memories.length,1);
 const transition:any=mind.getRecords().at(-1)!.payload;assert.equal(transition.before.beliefs.length,2);assert.equal(transition.after.beliefs[0].statement,'I have 3 coins and one crate.');
 for(const saved of [mind.exportRecording(),mind.exportCompactRecording()])assert.deepEqual(restoreMind(saved,provider).getSnapshot(),mind.getSnapshot());
});
test('unknown, duplicate, unsourced or conflicting retirements fail atomically',async()=>{
 for(const corrupt of ['unknown','duplicate','evidence','replacement','conflict']){
 const update:any=reconciled();if(corrupt==='unknown')update.beliefRetirements[0].id='missing';if(corrupt==='duplicate')update.beliefRetirements.push(update.beliefRetirements[0]);if(corrupt==='evidence')update.beliefRetirements[0].evidenceIds=[];if(corrupt==='replacement')update.beliefRetirements[0].supersededBy='missing';if(corrupt==='conflict')update.beliefRetirements[0].id='balance';
 const mind=createMind(character(),{appraise:async()=>({...proposal(),...update})});const before=mind.exportRecording();await assert.rejects(mind.ingest(observation()));assert.deepEqual(mind.exportRecording(),before);
 }
});
test('late failure rolls back reconciliation and retry commits once',async()=>{
 let fail=true;const provider:any={appraise:async()=>proposal(),stages:{updateBeliefs:async()=>reconciled(),appraiseEmotions:async()=>{if(fail)throw Error('late');return {moodDeltas:{},emotionDeltas:{},metadata};}}};const mind=createMind(character(),provider);const before=mind.exportRecording();await assert.rejects(mind.ingest(observation()));assert.deepEqual(mind.exportRecording(),before);fail=false;await mind.ingest(observation());assert.equal(mind.getSnapshot().beliefs.length,1);assert.equal((await mind.ingest(observation())).duplicate,true);
});

test('Jev accepts or rejects a merge as one unit and never needs confidence for retirement',async()=>{
 for(const accepted of [true,false]){
  const requests:any[]=[];
  const provider=createOpenRouterProvider({apiKey:'test',model:'luna',appraisalDecisionModel:'typesafe/jev-1.13',fetch:async(_url,init)=>{
   const body=JSON.parse(String(init!.body));requests.push(body);
   if(!body.questions)return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({candidates:[{id:'balance',statement:'I have 3 coins and one crate.',retireIds:['offer'],evidenceIds:['event-1']}],explanation:null})}}]});
   return Response.json({model:'typesafe/jev-1.13',usage:{},answers:Object.fromEntries(Object.keys(body.questions).map(id=>[id,{type:'noul',noul:id.startsWith('adopt_')?(accepted?.9:.2):.93}]))});
  }});
  const initial=character();const runtime=createMind(initial,{appraise:async()=>proposal()});await runtime.ingest(observation());
  const result=await provider.stages!.updateBeliefs({mind:runtime.getSnapshot(),memories:runtime.getSnapshot().memories,observation:observation()});
  assert.equal(result.beliefUpdates.length,accepted?1:0);assert.equal(result.beliefRetirements?.length??0,accepted?1:0);
  if(accepted)assert.equal(result.beliefRetirements![0]!.supersededBy,'balance');
 }
 const provider=createOpenRouterProvider({apiKey:'test',model:'luna',appraisalDecisionModel:'typesafe/jev-1.13',fetch:async(_url,init)=>{
  const body=JSON.parse(String(init!.body));
  if(!body.questions)return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({candidates:[{id:'offer',statement:null,retireIds:[],evidenceIds:['event-1']}],explanation:null})}}]});
  assert.deepEqual(Object.keys(body.questions),['adopt_0']);return Response.json({model:'typesafe/jev-1.13',usage:{},answers:{adopt_0:{type:'noul',noul:.9}}});
 }});
 const mind=createMind(character(),{appraise:async()=>proposal()});await mind.ingest(observation());const result=await provider.stages!.updateBeliefs({mind:mind.getSnapshot(),memories:mind.getSnapshot().memories,observation:observation()});assert.deepEqual(result.beliefUpdates,[]);assert.equal(result.beliefRetirements![0]!.supersededBy,null);
});

test('combined appraisal reconciliation also restores through expanded and compact recordings',async()=>{
 const provider:any={appraise:async()=>({...proposal(),...reconciled()})};const mind=createMind(character(),provider);await mind.ingest(observation());
 for(const recording of [mind.exportRecording(),mind.exportCompactRecording()])assert.deepEqual(restoreMind(recording,provider).getSnapshot(),mind.getSnapshot());
 const tampered:any=mind.exportCompactRecording();tampered.operations[0].proposal.beliefRetirements[0].supersededBy='missing';assert.throws(()=>restoreMind(tampered,provider));
});
