import { restoreMind } from '@minds/core';
import { createFixtureProvider } from '../apps/playbox/server/scenario.ts';
import { test, expect } from '@playwright/test';
let browserErrors:string[]=[];
test.beforeEach(async({request,page})=>{browserErrors=[];page.on('pageerror',e=>browserErrors.push(e.message));await request.post('/api/run',{data:{mode:'fixture'}});await page.goto('/');await expect(page.getByRole('heading',{name:'Marta',exact:true})).toBeVisible();});
test.afterEach(()=>{expect(browserErrors).toEqual([]);});
test('step alternates traders, structured acceptance executes and export restores both Minds',async({page})=>{
 await expect(page.getByRole('group',{name:'Select Mind'}).getByRole('button')).toHaveCount(2);
 await page.getByRole('button',{name:'Step conversation'}).click();await expect(page.locator('.trade-state')).toContainText('Next: ivo');await expect(page.locator('.trade-state')).toContainText('5 coins');
 await page.getByRole('button',{name:'Run conversation'}).click();await expect(page.locator('.trade-state')).toContainText('Deal executed · 7 coins');await expect(page.locator('.trade-state')).toContainText('Marta: 3 coins · 1 crate');await expect(page.getByRole('button',{name:'Step conversation'})).toBeDisabled();await expect(page.getByTestId('intentions')).toContainText('completed');
 const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Export recording'}).click();const stream=await(await promise).createReadStream();const chunks:Buffer[]=[];for await(const c of stream!)chunks.push(c);const recording=JSON.parse(Buffer.concat(chunks).toString());expect(recording.world.transaction.price).toBe(7);expect(recording.minds).toHaveLength(2);for(const journal of recording.minds)expect(restoreMind(journal,createFixtureProvider()).getSnapshot().actions!.some(a=>a.status==='executed')).toBe(true);
});
test('clean injection chooses recipients and selection supports keyboard',async({page})=>{
 await page.getByLabel('Ivo',{exact:true}).uncheck();await page.getByLabel('Observation content').fill('A private market observation.');await page.getByRole('button',{name:'Inject observation'}).click();await expect(page.getByTestId('memories')).toContainText('private market observation');
 const ivo=page.getByRole('group',{name:'Select Mind'}).getByRole('button',{name:/Ivo/});await ivo.focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Ivo',exact:true})).toBeVisible();await expect(page.getByTestId('memories')).not.toContainText('private market observation');await expect(page.getByLabel('Processing')).toHaveCount(0);await expect(page.getByLabel('Provenance')).toHaveCount(0);
});

test('commit transition shows readable before/after changes with raw JSON collapsed',async({page})=>{
 await page.getByRole('button',{name:'Step conversation'}).click();
 const transition=page.getByTestId('decision-sequence').locator('.mi-sequence-step').filter({has:page.locator('summary').filter({hasText:'Commit state transition'})}).first();
 await transition.locator('summary').first().click();
 const changes=transition.getByTestId('transition-changes');
 await expect(changes.getByRole('region',{name:'New memories'})).toContainText('Marta and Ivo meet at the apple market.');
 await expect(changes.getByRole('region',{name:'New memories'}).locator('article')).toHaveCount(1);
 await expect(changes).toContainText('Before'); await expect(changes).toContainText('After'); await expect(changes).toContainText('Adopted');
 await expect(changes.locator('pre')).not.toBeVisible();
 await changes.getByText('Full transition · raw data',{exact:true}).click(); await expect(changes.locator('pre')).toBeVisible();
});
test('action diagnostics expose generation selection expression and status; historical turns remain selectable',async({page})=>{
 await page.getByRole('button',{name:'Step conversation'}).click();const seq=page.getByTestId('decision-sequence');await expect(seq).toContainText('Generate action candidates');await expect(seq).toContainText('Select action');await expect(seq).toContainText('Express selected action');await expect(seq).toContainText('Action status receipt');
 await expect(seq.locator('.mi-step-brief').filter({hasText:'Selected · Offer a price favorable to my own goal.'})).toBeVisible();
 await expect(seq.locator('.mi-step-brief').filter({hasText:'offer → executed'})).toBeVisible();
 await page.getByLabel('Selected turn').selectOption('0');await page.getByRole('button',{name:'Step conversation'}).click();await expect(page.getByLabel('Selected turn')).toHaveValue('0');await expect(page.getByTestId('memories')).toContainText('No observations');await page.getByRole('button',{name:'Latest turn',exact:true}).click();await expect(page.getByTestId('memories')).not.toContainText('No observations');await page.getByRole('button',{name:'Reset run'}).click();await expect(page.getByTestId('record-detail')).toContainText('Select a record');await expect(page.getByLabel('Selected turn').getByRole('option')).toHaveCount(1);await expect(page.locator('.trade-state')).toContainText('No utterances yet');
});
test('validation rejects empty observations and pending controls disable until retry',async({page,request})=>{
 await page.getByRole('button',{name:'Inject observation'}).click();await expect(page.getByRole('alert')).toContainText('Supply observable content');const initial=await(await request.get('/api/run')).json();let release!:()=>void;const wait=new Promise<void>(r=>{release=r;});await page.route('**/api/step',async route=>{await wait;await route.fulfill({json:{...initial,status:'failed',errors:[{mindId:'marta',observationId:'opportunity',message:'Action plan failed. Retry this stage.'}]}});});await page.getByRole('button',{name:'Step conversation'}).click();await expect(page.getByRole('button',{name:'Reset run'})).toBeDisabled();await expect(page.getByRole('button',{name:'Inject observation'})).toBeDisabled();release();await expect(page.getByRole('button',{name:'Retry failed stage'})).toBeEnabled();await page.getByRole('button',{name:'Retry failed stage'}).click();await expect(page.getByRole('alert')).toHaveCount(0);
});
test('reloading during pending cognition resumes polling',async({page,request})=>{const initial=await(await request.get('/api/run')).json();let pending=true;await page.route('**/api/run',async route=>{await route.fulfill({json:{...initial,status:pending?'pending':'ready'}});});await page.reload();await expect(page.getByRole('button',{name:'Reset run'})).toBeDisabled();pending=false;await expect(page.getByRole('button',{name:'Reset run'})).toBeEnabled();});
