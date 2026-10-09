import { test, expect } from '@playwright/test';
import { createOpenRouterProvider } from '@minds/core/openrouter';
import { createHost } from '../apps/playbox/server/host.ts';

test('real hybrid records expose Jev thresholds and supplemental revision calls', async ({ page }) => {
  const provider = createOpenRouterProvider({ apiKey: 'browser-test-secret', model: 'appraisal', intentions: true,
    intentionGenerationModel: 'generator', intentionDecisionModel: 'typesafe/jev-1.13',
    fetch: async (_url, init) => {
      const b = JSON.parse(init!.body as string);
      if (b.questions) return Response.json({ model: 'typesafe/jev-1.13', usage: { cost: 0.00002 },
        answers: Object.fromEntries(Object.entries(b.questions).map(([id, value]) => {
          const q = value as { type: string; criteria: Record<string, string> };
          return [id, q.type === 'score' ? { type: 'score', score: 3, probabilities: { 0: 0, 1: 0, 2: 0, 3: 1, 4: 0 } } :
            q.type === 'choice' ? { type: 'choice', choice: 'revise', probabilities: Object.fromEntries(Object.keys(q.criteria).map(k => [k, k === 'revise' ? 1 : 0])) } :
            { type: 'noul', noul: id === 'generate_more' ? 0.1 : 0.9 }];
        })) });
      const name = b.response_format.json_schema.name; const context = JSON.parse(b.messages[1].content);
      const output = name === 'mind_appraisal' ? { beliefUpdates: [], moodDeltas: {}, emotionDeltas: {}, explanation: null } :
        name === 'mind_intention_revision_proposals' ? { revisions: context.requestedRevisionIds.map((intentionId: string) => ({ intentionId, action: 'revise', description: 'Monitor restored water access', priority: 0.8, supportingBeliefIds: [], evidenceIds: [context.observation.id] })), explanation: null } :
        { candidates: [{ id: 'a', description: 'Negotiate fair water access', priority: 0.8, supportingBeliefIds: [] }], explanation: null };
      return Response.json({ model: b.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] });
    } });
  const host = createHost(provider, 'openrouter', 'jev-ui'); let view = host.getView();
  await page.route('**/api/config', route => route.fulfill({ json: { openrouterAvailable: true, model: 'appraisal', intentionGenerationModel: 'generator', intentionDecisionModel: 'typesafe/jev-1.13', intentionDecisionEndpoint: 'decisions' } }));
  await page.route('**/api/run', route => route.fulfill({ json: view }));
  await page.route('**/api/step', async route => { view = await host.inject({ content: 'An observable market update.', recipients: ['marta'] }); await route.fulfill({ json: view }); });
  await page.goto('/'); await page.getByRole('button', { name: 'Step conversation' }).click();
  const sequence = page.getByTestId('decision-sequence');
  await sequence.getByText('Evaluate intention candidate', { exact: true }).click();
  await sequence.getByText('Jev probabilities and decision thresholds', { exact: true }).first().click();
  await expect(sequence).toContainText('"threshold": 0.65');
  await sequence.getByText('Exact Jev request · state and questions', { exact: true }).first().click();
  await expect(sequence).toContainText('"type": "noul"');
  await page.getByRole('button', { name: 'Step conversation' }).click();
  await sequence.getByText('Reconsider commitments', { exact: true }).click();
  await expect(sequence).toContainText('1 appraisal · 3 planning calls');
  await expect(sequence).toContainText('Additional call · revision-proposal · openrouter · generator');
  await expect(sequence).toContainText('Additional call · revision-evaluation · openrouter · typesafe/jev-1.13');
  await expect(page.getByTestId('intentions')).toContainText('Monitor restored water access');
  expect(JSON.stringify(view)).not.toContain('browser-test-secret');
});

test('sequential Jev appraisal exposes updated belief context, emotional deltas and real call totals', async ({ page }) => {
  const provider = createOpenRouterProvider({ apiKey: 'browser-staged-secret', model: 'luna', appraisalDecisionModel: 'typesafe/jev-1.13', fetch: async (_url, init) => {
    const b = JSON.parse(init!.body as string);
    if (!b.questions) return Response.json({ model: 'luna', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ candidates: [{ id: 'market', statement: 'The reported shortage reduces apple supply', evidenceIds: ['injected-1'] }], explanation: null }) } }] });
    return Response.json({ model: 'typesafe/jev-1.13', usage: { cost: 0.00002 }, answers: Object.fromEntries(Object.entries(b.questions).map(([id, value]) => {
      const q = value as { type: string; criteria: string[] };
      return [id, q.type === 'noul' ? { type: 'noul', noul: 0.8 } : { type: 'score', score: 6, probabilities: Object.fromEntries(q.criteria.map((_, i) => [i, i === 6 ? 1 : 0])) }];
    })) });
  } });
  const host = createHost(provider, 'openrouter', 'staged-ui'); let view = host.getView();
  await page.route('**/api/config', route => route.fulfill({ json: { openrouterAvailable: true, model: 'luna', appraisalDecisionModel: 'typesafe/jev-1.13' } }));
  await page.route('**/api/run', route => route.fulfill({ json: view }));
  await page.route('**/api/step', async route => { view = await host.inject({ content: 'An observable market update.', recipients: ['marta'] }); await route.fulfill({ json: view }); });
  await page.goto('/'); await page.getByRole('button', { name: 'Step conversation' }).click();
  const sequence = page.getByTestId('decision-sequence');
  await expect(sequence).toContainText('3 appraisal calls · 0 planning calls');
  await sequence.getByText('Update beliefs', { exact: true }).click();
  await expect(sequence).toContainText('80% confidence');
  await expect(sequence).toContainText('Additional call · belief-proposals · openrouter · luna');
  await sequence.getByText('Appraise emotions', { exact: true }).click();
  await sequence.getByText('Exact recorded appraisal input', { exact: true }).last().click();
  await expect(sequence).toContainText('The reported shortage reduces apple supply');
  await expect(sequence).toContainText('Emotion / anger: +0.150');
  await page.getByRole('button', { name: /#5.*Decision/ }).click();
  await expect(page.getByTestId('record-detail')).toContainText('Appraise emotions');
  await expect(page.getByTestId('anger-value')).toHaveText('0.150');
  expect(view.minds[0]!.snapshot.schemaVersion).toBe(6);
  expect(JSON.stringify(view)).not.toContain('browser-staged-secret');
});



