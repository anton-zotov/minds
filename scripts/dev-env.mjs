import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
export function developmentEnvironments(root, inherited = process.env) {
  let file = {};
  try { file = parseEnv(readFileSync(resolve(root, '.env'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const api = { ...file, ...inherited };
  const web = { ...api };
  for (const key of Object.keys(web)) if (key.startsWith('OPENROUTER_')) delete web[key];
  return { api, web };
}
