import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const gate = resolve(process.cwd(), '../scripts/check-production-copy.mjs');
const targets = [
  resolve(process.cwd(), 'dist'),
  resolve(process.cwd(), '../aadharchain/gateway/main.py'),
  resolve(process.cwd(), '../aadharchain/gateway/app/ondc_bpp.py'),
];

if (![gate, ...targets].every(existsSync)) {
  console.log('Workspace production copy gate skipped in standalone app checkout.');
  process.exit(0);
}

const result = spawnSync(process.execPath, [gate, ...targets], { stdio: 'inherit' });
process.exit(result.status ?? 1);
