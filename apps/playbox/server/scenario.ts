import type { MindConfig, CognitionProvider } from '@minds/core';
export function createScenario(runId: string, planning = true): MindConfig[] {
  return [{ mindId: 'marta', name: 'Marta', goal: 'Buy one crate of apples as cheaply as possible; pay no more than 8 coins.', belief: 'I have 10 coins and want one crate of apples.' },
    { mindId: 'ivo', name: 'Ivo', goal: 'Sell my crate of apples for as much as possible; accept no less than 6 coins.', belief: 'I own one crate of apples to sell.' }].map(c => ({ runId, mindId: c.mindId, identity: { name: c.name, description: c.mindId === 'marta' ? 'Patient buyer seeking good value.' : 'Patient seller seeking a good price.' }, goal: c.goal, time: 0,
    beliefs: [{ id: 'initial', statement: c.belief, confidence: 1, evidenceIds: [] }], mood: { calm: { value: 0.6, baseline: 0.6, halfLifeMs: 5000 } }, emotions: { anger: { value: 0, baseline: 0, halfLifeMs: 1000 }, hope: { value: 0.2, baseline: 0.2, halfLifeMs: 3000 } },
    ...(planning ? { intentionPolicy: { maxCandidates: 6, maxEvaluations: 6, maxActive: 3, seed: 42 } } : {}) }));
}
const metadata = (explanation: string) => ({ provider: 'deterministic-fixture', model: null, explanation, parameters: {} });
export function createFixtureProvider(): CognitionProvider {
  return { appraise: async context => {
    const event=context.observation, ownName=context.mind.config.identity.name;
    const balance=event.source==='market-host'&&event.content.startsWith('Transaction executed:')?event.content.match(new RegExp(`${ownName} now has (\\d+) coins and (\\d+) crate`)):null;
    const beliefUpdates=balance?[{id:'initial',statement:`I have ${balance[1]} coins and ${balance[2]} crate of apples.`,confidence:1,evidenceIds:[event.id]},{id:'market',statement:'The apple trade is complete.',confidence:1,evidenceIds:[event.id]}]:event.kind==='elapsed-time'?[]:[{id:'market',statement:event.content,confidence:1,evidenceIds:[event.id]}];
    return {beliefUpdates,moodDeltas:{},emotionDeltas:{},metadata:metadata('Offline fixture revises current facts using observed market outcomes.')};
  },
    intentions: {
      generate: async context => ({ candidates: [{ id: 'trade', description: context.mind.config.goal, priority: 0.9, supportingBeliefIds: ['initial'] }], metadata: metadata('Pursue the acting Mind’s own goal.') }),
      evaluate: async () => ({ accept: true, scores: { goalAlignment: 1, feasibility: 0.9, emotionalCompatibility: 0.9, novelty: 1, compatibility: 1 }, metadata: metadata('Own trade goal is feasible.') }),
      sufficient: async () => ({ sufficient: true, metadata: metadata('One trade strategy suffices.') }),
      reconsider: async context => ({ revisions: /Transaction executed/.test(context.observation.content) ? (context.mind.intentions ?? []).filter(i => i.status === 'active').map(i => ({ intentionId: i.id, action: 'complete' as const, evidenceIds: [context.observation.id] })) : [], generateMore: false, metadata: metadata('Only observed transfer evidence completes this fixture strategy.') }),
    },
    actions: {
      generate: async context => {
        const buyer = /Buy one/.test(context.mind.config.goal);
        const limit = Number(context.mind.config.goal.match(/(?:more|less) than (\d+)/)?.[1]);
        const accept = context.opportunity.capabilities.find(c => c.id === 'accept');
        const priceParameter = accept?.parameters.find(p => p.name === 'price');
        const offered = priceParameter?.min;
        const acceptable = offered !== undefined && (buyer ? offered <= limit : offered >= limit);
        const capability = context.opportunity.capabilities.find(c => c.id === (acceptable ? 'accept' : 'offer'))!;
        const prior = context.memories.map(m => m.observation.content).join('\n');
        const price = acceptable ? offered! : buyer ? (/offers \d+ coins/.test(prior) ? limit - 1 : limit - 3) : limit + 1;
        const parameters: Record<string, string | number> = { price };
        if (acceptable) parameters.offerId = accept!.parameters.find(p => p.name === 'offerId')!.enum![0]!;
        return { candidates: [{ id: 'trade-action', capabilityId: capability.id, targetId: capability.targets[0]!, intentionId: context.mind.intentions?.find(i => i.status === 'active')?.id ?? null, objective: acceptable ? 'Accept a price within my own limit.' : 'Offer a price favorable to my own goal.', parameters }], metadata: metadata('Fixture uses only acting Mind context and allowed capabilities.') };
      },
      select: async context => ({ candidateId: context.candidates[0]?.id ?? null, scores: context.candidates.map(c => ({ candidateId: c.id, score: 0.9 })), metadata: metadata('Choose the fixture’s feasible action.') }),
      express: async context => ({ speech: context.candidate.capabilityId === 'accept' ? `I accept your offer of ${context.candidate.parameters.price} coins.` : `I offer ${context.candidate.parameters.price} coins for the crate of apples.`, metadata: metadata('Express the selected structured action.') }),
    },
  };
}


