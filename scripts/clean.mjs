import { rmSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const relative of ['.test-dist', 'packages/minds/dist']) {
  const target = resolve(root, relative);
  if (!target.startsWith(root + sep)) throw new Error('Build output must stay inside workspace');
  rmSync(target, { recursive: true, force: true });
}
