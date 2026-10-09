import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { developmentEnvironments } from './dev-env.mjs';
const root = resolve(import.meta.dirname, '..');
const environments = developmentEnvironments(root);
const children = [
  spawn(process.execPath, ['apps/playbox/server/main.ts'], { cwd: root, stdio: 'inherit', windowsHide: true, env: environments.api }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'apps/playbox', '--host', '127.0.0.1'], { cwd: root, stdio: 'inherit', windowsHide: true, env: environments.web }),
];
function stop() { for (const child of children) child.kill(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
for (const child of children) child.on('exit', code => { stop(); process.exitCode = code ?? 0; });
