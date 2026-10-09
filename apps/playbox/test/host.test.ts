import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreMind } from '@minds/core';
import { createHost } from '../server/host.ts';
import { createFixtureProvider } from '../server/scenario.ts';
test('offline negotiation alternates actors, executes exactly once and restores both journals', async () => {
 const provider=createFixtureProvider(),host=createHost(provider,'fixture'); const first=await host.step(); assert.equal(first.world!.nextActorId,'ivo'); assert.equal(first.world!.offers[0]!.price,5); assert.equal(first.world!.transaction,null);
 const second=await host.step(); assert.equal(second.world!.nextActorId,'marta'); assert.equal(second.world!.offers.at(-1)!.price,7);
 const final=await host.step(); assert.equal(final.world!.transaction!.price,7); assert.deepEqual(final.world!.balances,{marta:3,ivo:7}); assert.deepEqual(final.world!.crates,{marta:1,ivo:0}); assert.equal(final.world!.transcript.length,3);
 await assert.rejects(host.step()); for(const [i,journal] of host.exportRecording().minds.entries()) assert.deepEqual(restoreMind(journal,provider).getSnapshot(),final.minds[i]!.snapshot);
 for(const [i,journal] of host.exportCompactRecording().minds.entries()) assert.deepEqual(restoreMind(journal,provider).getSnapshot(),final.minds[i]!.snapshot);
 assert.ok(final.minds.every(m=>m.snapshot.intentions!.some(i=>i.status==='completed')));
 assert.equal(final.minds[0]!.snapshot.beliefs.find(b=>b.id==='initial')!.statement,'I have 3 coins and 1 crate of apples.');
 assert.equal(final.minds[1]!.snapshot.beliefs.find(b=>b.id==='initial')!.statement,'I have 7 coins and 0 crate of apples.');
 assert.ok(final.minds.every(m=>m.snapshot.beliefs.length===2));
});
test('private limits are scoped to acting Mind and public observation only',async()=>{
 const p=createFixtureProvider(),generate=p.actions!.generate; const contexts:unknown[]=[]; p.actions!.generate=async c=>{contexts.push(c);return generate(c);}; const h=createHost(p,'fixture');await h.runConversation();
 for(const raw of contexts){const c=raw as any; const text=JSON.stringify(c); assert.equal(text.includes(c.mind.config.mindId==='marta'?'no less than 6':'no more than 8'),false); assert.equal(Object.hasOwn(c,'world'),false);}
});
test('transaction survives partial recipient failure and retries without execution or speech duplication',async()=>{
 const p=createFixtureProvider(),appraise=p.appraise;let fail=true;p.appraise=async c=>{if(fail&&c.mind.config.mindId==='ivo'&&/Transaction executed/.test(c.observation.content))throw Error('SECRET');return appraise(c);};const h=createHost(p,'fixture');const failed=await h.runConversation();assert.equal(failed.status,'failed');assert.equal(failed.world!.transaction!.price,7);assert.equal(failed.world!.transcript.length,3);assert.equal(JSON.stringify(failed).includes('SECRET'),false); const before=failed.world;fail=false;const recovered=await h.retry();assert.equal(recovered.status,'ready');assert.deepEqual(recovered.world!.balances,before!.balances);assert.equal(recovered.world!.transcript.length,3);
 for(const m of recovered.minds){const ids=m.snapshot.memories.map(x=>x.observation.id);assert.equal(new Set(ids).size,ids.length);assert.equal(m.snapshot.memories.filter(x=>/Transaction executed/.test(x.observation.content)).length,1);}
});
test('planning failure retries the same opportunity and does not advance actor',async()=>{
 const p=createFixtureProvider(),gen=p.actions!.generate;let fail=true;p.actions!.generate=async c=>{if(fail)throw Error('offline');return gen(c);};const h=createHost(p,'fixture');assert.equal((await h.step()).status,'failed');assert.equal(h.getView().world!.turnCount,0);fail=false;const v=await h.retry();assert.equal(v.status,'ready');assert.equal(v.world!.turnCount,1);assert.equal(v.world!.transcript.length,1);
});
test('speech alone cannot execute trade and no-action run is bounded',async()=>{
 const p=createFixtureProvider();p.actions!.generate=async c=>({candidates:[{id:'speech',capabilityId:'speak',targetId:c.opportunity.capabilities[0]!.targets[0]!,intentionId:null,objective:'Talk',parameters:{}}],metadata:{provider:'fixture',model:null,explanation:null,parameters:{}}});p.actions!.express=async()=>({speech:'I accept the deal for 7 coins.',metadata:{provider:'fixture',model:null,explanation:null,parameters:{}}});const h=createHost(p,'fixture');await h.runConversation();assert.equal(h.getView().world!.transaction,null);assert.equal(h.getView().world!.turnCount,12);
 p.actions!.generate=async()=>({candidates:[],metadata:{provider:'fixture',model:null,explanation:null,parameters:{}}});const empty=createHost(p,'fixture');await empty.runConversation();assert.equal(empty.getView().world!.turnCount,12);assert.equal(empty.getView().world!.transcript.length,0);
});
test('injection validates all controls before mutation and isolates recipients',async()=>{
 const h=createHost(createFixtureProvider(),'fixture');const before=h.exportRecording();for(const field of ['processing','provenance','intentionCompletions'])await assert.rejects(h.inject({content:'fact',recipients:['marta'],[field]:undefined} as any));assert.deepEqual(h.exportRecording(),before);await assert.rejects(h.inject({content:'fact',recipients:['missing']}));const v=await h.inject({content:'Private observation',recipients:['marta']});assert.equal(v.minds[0]!.snapshot.memories.length,1);assert.equal(v.minds[1]!.snapshot.memories.length,0);
});
test('clock advances both Minds without new world facts, and stays in current turn',async()=>{const h=createHost(createFixtureProvider(),'fixture');await h.step();const before=h.getView();await h.advanceTime();const after=h.getView();assert.equal(after.time,1000);assert.equal(after.turns!.length,before.turns!.length);for(const [i,m]of after.minds.entries()){assert.equal(m.snapshot.time,1000);assert.deepEqual(m.snapshot.beliefs,before.minds[i]!.snapshot.beliefs);}});
test('initial delivery failure retries only failed recipients before first action',async()=>{const p=createFixtureProvider(),appraise=p.appraise;let fail=true;p.appraise=async c=>{if(fail&&c.mind.config.mindId==='ivo')throw Error('offline');return appraise(c);};const h=createHost(p,'fixture');assert.equal((await h.step()).status,'failed');assert.equal(h.getView().world!.transcript.length,0);fail=false;await h.retry();await h.step();for(const m of h.getView().minds)assert.equal(m.snapshot.memories.filter(x=>x.observation.id==='market-introduction').length,1);});

test('failed self speech blocks that recipients outcome until retry preserves causal order',async()=>{
 const p=createFixtureProvider(),appraise=p.appraise;let fail=true;p.appraise=async c=>{if(fail&&c.mind.config.mindId==='marta'&&c.observation.kind==='speech'&&/I accept/.test(c.observation.content))throw Error('offline');return appraise(c);};const h=createHost(p,'fixture');const v=await h.runConversation();assert.equal(v.status,'failed');assert.equal(v.world!.transaction!.price,7);assert.equal(v.minds[0]!.snapshot.memories.some(m=>/Transaction executed/.test(m.observation.content)),false);assert.equal(v.minds[1]!.snapshot.memories.some(m=>/Transaction executed/.test(m.observation.content)),true);fail=false;const recovered=await h.retry();const events=recovered.minds[0]!.snapshot.memories.map(m=>m.observation.content);assert.ok(events.findIndex(c=>/I accept/.test(c))<events.findIndex(c=>/Transaction executed/.test(c)));assert.equal(recovered.world!.transcript.length,3);assert.deepEqual(recovered.world!.balances,{marta:3,ivo:7});
});

test('host rejects fractional offers with a submitted then rejected receipt and no utterance',async()=>{const p=createFixtureProvider(),generate=p.actions!.generate;p.actions!.generate=async c=>{const result=await generate(c);result.candidates[0]!.parameters.price=5.5;return result;};const h=createHost(p,'fixture');const v=await h.step();assert.equal(v.world!.offers.length,0);assert.equal(v.world!.transcript.length,0);assert.equal(v.minds[0]!.snapshot.actions![0]!.status,'rejected');assert.ok(v.minds[0]!.records.some(r=>(r.payload as any)?.operation?.status==='submitted'));assert.deepEqual(v.world!.balances,{marta:10,ivo:0});});


test('expression retry preserves selected action and does not regenerate or duplicate utterance',async()=>{const p=createFixtureProvider(),generate=p.actions!.generate,select=p.actions!.select,express=p.actions!.express;let generations=0,selections=0,fail=true;p.actions!.generate=async c=>{generations++;return generate(c);};p.actions!.select=async c=>{selections++;return select(c);};p.actions!.express=async c=>{if(fail)throw Error('offline');return express(c);};const h=createHost(p,'fixture');assert.equal((await h.step()).status,'failed');assert.equal(h.getView().world!.transcript.length,0);fail=false;const v=await h.retry();assert.equal(v.status,'ready');assert.equal(generations,1);assert.equal(selections,1);assert.equal(v.world!.offers[0]!.price,5);assert.equal(v.world!.transcript.length,1);});

test('wall-clock durations measure slow providers independently from simulation time', async () => {
 const provider = createFixtureProvider(), generate = provider.actions!.generate;
 provider.actions!.generate = async context => { await new Promise(resolve => setTimeout(resolve, 25)); return generate(context); };
 const host = createHost(provider, 'fixture'); const view = await host.step();
 assert.equal(view.time, 0); assert.ok(view.turns!.at(-1)!.durationMs! >= 20);
 const mind = view.minds[0]!; const record = mind.records.find(r => (r.payload as any).stage === 'action-generation')!;
 assert.ok(mind.recordDurations![record.id]! >= 20);
 for (const r of mind.records) assert.ok(Number.isFinite(mind.recordDurations![r.id]));
 assert.deepEqual(host.getView().minds[0]!.recordDurations, mind.recordDurations);
 const restored = restoreMind(host.exportCompactRecording().minds[0], provider);
 assert.deepEqual(restored.getRecordDurations(), {});
 assert.equal(JSON.stringify(host.exportCompactRecording().minds).includes('durationMs'), false);
});
test('bounded conversation measures each actor turn separately', async () => {
 const view = await createHost(createFixtureProvider(), 'fixture').runConversation();
 assert.equal(view.turns!.length, 4);
 assert.deepEqual(view.turns!.slice(1).map(t => t.mindId), ['marta', 'ivo', 'marta']);
 assert.ok(view.turns!.slice(1).every(t => Number.isFinite(t.durationMs)));
});

test('invalid action output retry measures the valid attempt, preserving cached stages', async () => {
 const provider = createFixtureProvider(), select = provider.actions!.select; let invalid = true;
 provider.actions!.select = async context => {
  if (invalid) return { ...(await select(context)), candidateId: 'unknown' };
  await new Promise(resolve => setTimeout(resolve, 25)); return select(context);
 };
 const host = createHost(provider, 'fixture'); assert.equal((await host.step()).status, 'failed');
 invalid = false; const view = await host.retry(); assert.equal(view.status, 'ready');
 const mind = view.minds[0]!, record = mind.records.find(r => (r.payload as any).stage === 'action-selection')!;
 assert.ok(mind.recordDurations![record.id]! >= 20);
});
