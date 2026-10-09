import { readFileSync } from 'node:fs';
import { restoreMind, type MindRecording, type CompactMindRecording } from '@minds/core';
import { createFixtureProvider } from '../apps/playbox/server/scenario.ts';
import { test, expect } from '@playwright/test';
test('independent Inspector renders actual recording data and navigates causes', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?embed=1');
  await expect(page.getByRole('heading', { name: 'Marta', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /#2.*Observation/ }).click();
  await expect(page.getByTestId('record-detail')).toContainText('agreement');
  await page.getByRole('button', { name: /#5.*Transition/ }).click();
  await expect(page.getByTestId('record-detail').getByRole('meter',{name:'Before anger',exact:true})).toHaveAttribute('value','0');
  await expect(page.getByTestId('record-detail').getByRole('meter',{name:'After anger',exact:true})).toHaveAttribute('value','0.4');
  await page.getByRole('button', { name: 'Cause #4 · Decision' }).click();
  await expect(page.getByTestId('record-detail')).toContainText('deterministic-fixture');
  await page.getByRole('button', { name: /Leon.*Reserve/ }).click();
  await expect(page.getByRole('heading', { name: 'Leon', exact: true })).toBeVisible();
  await expect(page.getByTestId('record-detail')).toContainText('Select a record');
  expect(errors).toEqual([]);
});
test('Inspector handles unsupported and empty views explicitly', async ({ page }) => {
  await page.goto('/?embed=unsupported'); await expect(page.getByRole('alert')).toContainText('Unsupported inspection schema');
  await page.goto('/?embed=empty'); await expect(page.getByText('No Minds supplied')).toBeVisible();
});

test('Inspector preserves historical provenance, memory-only and host-completion diagnostics', async ({ page }) => {
  const fixtures = JSON.parse(readFileSync(new URL('../packages/minds/test/fixtures/legacy-events.json', import.meta.url), 'utf8')) as { version: number; expanded: MindRecording; compact: CompactMindRecording }[];
  for (const fixture of fixtures) {
    for (const recording of [fixture.expanded, fixture.compact]) {
      const mind = restoreMind(recording, createFixtureProvider());
      const snapshot = mind.getSnapshot(); const records = mind.getRecords();
      const view = { schemaVersion: 1, runId: 'legacy', time: snapshot.time, providerMode: 'fixture', status: 'ready', errors: [], minds: [{ snapshot, records }] };
      await page.route('**/api/run', route => route.fulfill({ json: view }));
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Alice', exact: true })).toBeVisible();
      await expect(page.getByTestId('memories')).toContainText('reported');
      await expect(page.getByTestId('decision-sequence')).toContainText('Appraisal skipped · memory-only observation');
      if (fixture.version === 3) {
        await expect(page.getByTestId('intentions')).toContainText('Legacy completion confirmed by the host');
        await expect(page.getByTestId('decision-sequence')).toContainText('Legacy host-confirmed completion');
      }
      await page.getByRole('button', { name: /#\d+.*Observation/ }).last().click();
      await expect(page.getByTestId('record-detail')).toContainText('Legacy memory-only observation');
      await page.unroute('**/api/run');
    }
  }
});
