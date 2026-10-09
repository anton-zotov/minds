import { createMind, type CognitionProvider, type MindAction, type Observation, type ActionOpportunity } from '@minds/core';
import type { InspectionView, InspectionTurn } from '../../../packages/inspector/src/contract.ts';
import { createScenario } from './scenario.ts';
export interface Injection { content: string; recipients: string[] }
export interface TradeOffer { id: string; ownerId: string; recipientId: string; price: number; status: 'open' | 'superseded' | 'accepted' }
export interface TradeWorld { balances: Record<string, number>; crates: Record<string, number>; offers: TradeOffer[]; transaction: { actionId: string; offerId: string; price: number } | null; transcript: { id: string; speakerId: string; recipientId: string; speech: string }[]; turnCount: number; nextActorId: string; stopReason: string | null }
export class InputError extends Error {}
export function createHost(provider: CognitionProvider, mode: InspectionView['providerMode'], runId = 'playbox-run') {
  const scenario = createScenario(runId, Boolean(provider.intentions));
  const recordDurations: Record<string, number> = {};
  const minds = scenario.map(c => {
    const timings = new Map<string, number[]>();
    const key = (stage: string, input: any) => JSON.stringify([stage, input.observation?.id ?? input.opportunity?.id]);
    const wrap = (target: any, stages: Record<string, string>) => new Proxy(target, { get(object, name) {
      const method = object[name];
      if (typeof name !== 'string' || !stages[name]) return method;
      return async (input: any) => {
        if (name === 'appraise' || name === 'updateBeliefs') {
          for (const id of timings.keys()) if (JSON.parse(id)[1] === input.observation?.id) timings.delete(id);
        }
        const start = performance.now();
        const output = await method.call(object, input);
        const id = key(stages[name]!, input);
        const elapsed = performance.now() - start;
        timings.set(id, stages[name]!.startsWith('action-') ? [elapsed] : [...(timings.get(id) ?? []), elapsed]);
        return output;
      };
    }});
    const timed = { ...provider, appraise: wrap(provider, { appraise: 'appraise' }).appraise,
      ...(provider.stages ? { stages: wrap(provider.stages, { updateBeliefs: 'belief-update', appraiseEmotions: 'emotional-appraisal' }) } : {}),
      ...(provider.intentions ? { intentions: wrap(provider.intentions, { reconsider: 'intention-reconsideration', generate: 'intention-generation', evaluate: 'intention-evaluation', sufficient: 'intention-sufficiency' }) } : {}),
      ...(provider.actions ? { actions: wrap(provider.actions, { generate: 'action-generation', select: 'action-selection', express: 'action-expression' }) } : {}) };
    const mind = createMind(c, timed);
    mind.subscribe(records => { for (const record of records) {
      const payload = record.payload as any;
      if (record.type !== 'decision') continue;
      const duration = timings.get(key(payload.stage ?? 'appraise', payload.input ?? payload.context ?? {}))?.shift();
      if (duration !== undefined) recordDurations[record.id] = duration;
    } timings.clear(); });
    return mind;
  });
  const world: TradeWorld = { balances: { marta: 10, ivo: 0 }, crates: { marta: 0, ivo: 1 }, offers: [], transaction: null, transcript: [], turnCount: 0, nextActorId: 'marta', stopReason: null };
  let time = 0, injected = 0, pending = 0, initialized = false; let queue = Promise.resolve(); let errors: InspectionView['errors'] = [];
  let failedDeliveries: { index: number; observation: Observation }[] = [];
  let active: { index: number; opportunity: ActionOpportunity; action: MindAction | null; stage: 'plan' | 'submit' | 'execute' | 'resolve' | 'deliver'; outcome?: { status: 'executed' | 'rejected'; reason: string | null }; deliveries: { index: number; observation: Observation }[] } | null = null;
  const turns: InspectionTurn[] = [];
  const positions = () => Object.fromEntries(minds.map(m => [m.getSnapshot().config.mindId, m.getRecordCount()]));
  function appendTurn(label: string, before: Record<string, number>, actor = world.nextActorId, durationMs?: number) { const after = positions(); turns.push({ id: String(turns.length), mindId: actor, kind: turns.length ? 'event' : 'initial', index: turns.length, label, time, ...(durationMs === undefined ? {} : { durationMs }), errors: structuredClone(errors), recordRanges: Object.fromEntries(scenario.map(c => [c.mindId, { afterSequence: before[c.mindId] ?? 0, throughSequence: after[c.mindId]! }])) }); }
  appendTurn('Initial state', {});
  const getView = (): InspectionView => ({ schemaVersion: 1, runId, time, status: pending ? 'pending' : errors.length ? 'failed' : 'ready', providerMode: mode, minds: minds.map(m => ({ snapshot: m.getSnapshot(), records: m.getRecords(), recordDurations: { ...m.getRecordDurations(), ...recordDurations } })), errors: structuredClone(errors), turns: structuredClone(turns), world: structuredClone(world) });
  function enqueue(label: string | null, op: () => Promise<void>) { pending++; const result = queue.then(async () => { const before = positions(), actor = world.nextActorId, started = performance.now(); await op(); const durationMs = performance.now() - started; if (label && label !== 'Conversation') appendTurn(label, before, actor, durationMs); else if (!label) { const latest = turns.at(-1)!; latest.durationMs = (latest.durationMs ?? 0) + durationMs; const after = positions(); for (const [id, throughSequence] of Object.entries(after)) latest.recordRanges[id]!.throughSequence = throughSequence; latest.errors = structuredClone(errors); } }).then(() => { pending--; return getView(); }, e => { pending--; throw e; }); queue = result.then(() => {}, () => {}); return result; }
  async function deliver(items: typeof failedDeliveries) { errors = []; failedDeliveries = []; const blocked = new Set<number>(); for (const item of items) { if (blocked.has(item.index)) { failedDeliveries.push(item); continue; } try { await minds[item.index]!.ingest(item.observation); } catch { blocked.add(item.index); failedDeliveries.push(item); errors.push({ mindId: scenario[item.index]!.mindId, observationId: item.observation.id, message: 'Observation delivery failed. Retry this stage.' }); } } }
  function requireRecovered() { if (errors.length) throw new InputError('Retry the failed stage or reset before continuing.'); }
  async function initialize() { if (initialized) return; initialized = true; await deliver(scenario.map((_, index) => ({ index, observation: { id: 'market-introduction', time, source: 'market-host', kind: 'market', content: 'Marta and Ivo meet at the apple market. Ivo has one crate of apples for sale; Marta is looking to buy one crate. They may speak, make offers, or accept a current offer.' } }))); }
  function opportunity(index: number): ActionOpportunity {
    const actor = scenario[index]!.mindId; const other = scenario[1 - index]!.mindId;
    const caps: ActionOpportunity['capabilities'] = [{ id: 'speak', description: 'Speak to the other trader; speech alone does not execute a transaction.', targets: [other], parameters: [], expression: 'speech' }, { id: 'offer', description: 'Offer a whole-number price in coins for one crate of apples.', targets: [other], parameters: [{ name: 'price', type: 'number', description: 'Price in coins', min: 0, max: 10 }], expression: 'speech' }];
    const latest = world.offers.filter(o => o.status === 'open').at(-1);
    if (latest?.recipientId === actor) caps.push({ id: 'accept', description: 'Accept the latest open offer addressed to you.', targets: [other], parameters: [{ name: 'offerId', type: 'string', description: 'Current offer identifier', enum: [latest.id] }, { name: 'price', type: 'number', description: 'Exact offered price', min: latest.price, max: latest.price }], expression: 'speech' });
    return { id: `${runId}-turn-${world.turnCount + 1}`, time: minds[index]!.getSnapshot().time, capabilities: caps };
  }
  function execute(action: MindAction, index: number) {
    const actor = scenario[index]!.mindId, other = scenario[1 - index]!.mindId, c = action.candidate;
    let fact = '', reason: string | null = null;
    if (world.transaction) reason = 'The trade is already closed.';
    else if (c.targetId !== other) reason = 'Recipient is not the other trader.';
    else if (c.capabilityId === 'offer') {
      const price = c.parameters.price;
      if (typeof price !== 'number' || !Number.isInteger(price) || price < 0 || price > world.balances.marta!) reason = 'Invalid price or insufficient buyer funds.';
      else { world.offers.filter(o => o.status === 'open').forEach(o => { o.status = 'superseded'; }); const offer: TradeOffer = { id: `offer-${world.offers.length + 1}`, ownerId: actor, recipientId: other, price, status: 'open' }; world.offers.push(offer); fact = `${actor} offers ${price} coins for one crate of apples. Offer ${offer.id} is addressed to ${other}.`; }
    } else if (c.capabilityId === 'accept') {
      const latest = world.offers.filter(o => o.status === 'open').at(-1);
      if (!latest || latest.id !== c.parameters.offerId || latest.ownerId !== other || latest.recipientId !== actor || latest.price !== c.parameters.price) reason = 'Offer is stale, has the wrong owner or recipient, or price differs.';
      else if (world.balances.marta! < latest.price || world.crates.ivo! < 1) reason = 'Insufficient funds or inventory.';
      else { world.balances.marta! -= latest.price; world.balances.ivo! += latest.price; world.crates.ivo!--; world.crates.marta!++; latest.status = 'accepted'; world.transaction = { actionId: action.id, offerId: latest.id, price: latest.price }; world.stopReason = 'Trade executed'; fact = `Transaction executed: Marta paid ${latest.price} coins to Ivo and received one crate of apples. Marta now has ${world.balances.marta} coins and ${world.crates.marta} crate; Ivo now has ${world.balances.ivo} coins and ${world.crates.ivo} crate.`; }
    } else if (c.capabilityId !== 'speak') reason = 'Unknown capability.';
    const deliveries: typeof failedDeliveries = [];
    if (!reason && action.expression !== null) { world.transcript.push({ id: action.id, speakerId: actor, recipientId: other, speech: action.expression }); scenario.forEach((_, i) => deliveries.push({ index: i, observation: { id: `${action.id}-speech-${i}`, time, source: actor, kind: 'speech', content: `${actor} says: ${action.expression}` } })); }
    if (reason) fact = `Action ${action.id} rejected: ${reason}`;
    if (fact) scenario.forEach((_, i) => deliveries.push({ index: i, observation: { id: `${action.id}-outcome-${i}`, time, source: 'market-host', kind: 'trade-outcome', content: fact } }));
    return { outcome: { status: reason ? 'rejected' as const : 'executed' as const, reason }, deliveries };
  }
  async function resume() {
    if (!active) return; const a = active;
    try {
      if (a.stage === 'plan') { a.action = (await minds[a.index]!.planAction(a.opportunity)).action; a.stage = a.action ? 'submit' : 'deliver'; }
      if (a.stage === 'submit') { await minds[a.index]!.submitAction(a.action!.id); a.stage = 'execute'; }
      if (a.stage === 'execute') { const result = execute(a.action!, a.index); a.outcome = result.outcome; a.deliveries = result.deliveries; a.stage = 'resolve'; }
      if (a.stage === 'resolve') { await minds[a.index]!.resolveAction({ actionId: a.action!.id, ...a.outcome! }); a.stage = 'deliver'; }
      if (a.stage === 'deliver') { await deliver(a.deliveries); a.deliveries = [...failedDeliveries]; if (errors.length) return; world.turnCount++; world.nextActorId = scenario[1 - a.index]!.mindId; if (world.turnCount >= 12 && !world.transaction) world.stopReason = 'Turn limit reached'; active = null; }
    } catch { errors = [{ mindId: scenario[a.index]!.mindId, observationId: a.opportunity.id, message: `Action ${a.stage} failed. Retry this stage.` }]; }
  }
  async function stepInternal() { requireRecovered(); if (world.transaction || world.turnCount >= 12) throw new InputError('Conversation has stopped. Reset to start a fresh market.'); await initialize(); if (errors.length) return; const index = scenario.findIndex(c => c.mindId === world.nextActorId); active = { index, opportunity: opportunity(index), action: null, stage: 'plan', deliveries: [] }; await resume(); }
  return { getView, getStatus: () => ({ runId, status: pending ? 'pending' : errors.length ? 'failed' : 'ready', recordCounts: minds.map(m => m.getRecordCount()) }),
    step: () => enqueue('Trade turn', stepInternal),
    runConversation: () => enqueue('Conversation', async () => { requireRecovered(); while (world.turnCount < 12 && !world.transaction && !errors.length) { const before = positions(), actor = world.nextActorId, started = performance.now(); await stepInternal(); appendTurn('Trade turn', before, actor, performance.now() - started); } }),
    retry: () => enqueue(null, async () => { errors = []; if (active) await resume(); else await deliver([...failedDeliveries]); }),
    advanceTime: () => enqueue(null, async () => { requireRecovered(); time += 1000; await deliver(scenario.map((c, index) => ({ index, observation: { id: `clock-${time}-${c.mindId}`, time, source: 'clock', kind: 'elapsed-time', content: '1000 ms have elapsed.' } }))); }),
    inject: async (input: Injection) => { if (!input || typeof input.content !== 'string' || !input.content.trim() || input.content.length > 10000 || !Array.isArray(input.recipients) || !input.recipients.length || new Set(input.recipients).size !== input.recipients.length || input.recipients.some(id => !scenario.some(c => c.mindId === id)) || Object.keys(input).some(k => !['content', 'recipients'].includes(k))) throw new InputError('Supply observable content and valid unique recipients only.'); const detached = structuredClone(input); return enqueue('Injected observation', async () => { requireRecovered(); const observationId = `injected-${++injected}`; await deliver(scenario.flatMap((c, index) => detached.recipients.includes(c.mindId) ? [{ index, observation: { id: observationId, time, source: 'operator', kind: 'injected', content: detached.content.trim() } }] : [])); }); },
    exportRecording: () => structuredClone({ schemaVersion: 1, runId, providerMode: mode, scenario, world, minds: minds.map(m => m.exportRecording()), turns }),
    exportCompactRecording: () => structuredClone({ schemaVersion: 2, runId, providerMode: mode, world, minds: minds.map(m => m.exportCompactRecording()), turns }),
  };
}
export type PlayboxHost = ReturnType<typeof createHost>;
export type PlayboxRecording = ReturnType<PlayboxHost['exportRecording']>;
export type CompactPlayboxRecording = ReturnType<PlayboxHost['exportCompactRecording']>;







