import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
test('development launcher shares root dotenv ports with Vite without forwarding provider keys', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'minds-dev-'));
  try {
    await writeFile(join(dir, '.env'), 'PLAYBOX_API_PORT=5194\nPLAYBOX_WEB_PORT=5193\nOPENROUTER_API_KEY=TEST_SECRET\n');
    const script = `import { developmentEnvironments } from ${JSON.stringify(new URL('../../../scripts/dev-env.mjs', import.meta.url).href)}; console.log(JSON.stringify(developmentEnvironments(${JSON.stringify(dir)})));`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { cwd: resolve('.'), windowsHide: true });
    let stdout = '', stderr = ''; child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    const code = await new Promise<number | null>(r => child.on('close', r)); assert.equal(code, 0, stderr);
    const environments = JSON.parse(stdout);
    assert.equal(environments.api.PLAYBOX_API_PORT, '5194'); assert.equal(environments.web.PLAYBOX_API_PORT, '5194');
    assert.equal(environments.web.PLAYBOX_WEB_PORT, '5193'); assert.equal(environments.api.OPENROUTER_API_KEY, 'TEST_SECRET');
    assert.equal(environments.web.OPENROUTER_API_KEY, undefined);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
