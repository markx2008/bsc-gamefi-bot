import fs from 'node:fs';
import assert from 'node:assert/strict';

const listener = fs.readFileSync(new URL('../server/src/services/listener.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(
  listener,
  /function requireEnv\(name: string\)/,
  'listener must define a reusable required environment variable validator',
);
assert.match(
  listener,
  /const DATABASE_URL = requireEnv\('DATABASE_URL'\)/,
  'listener must validate DATABASE_URL before Prisma performs queries',
);
assert.match(
  listener,
  /const VAULT_ADDRESS = requireEnv\('VAULT_ADDRESS'\) as `0x\$\{string\}`/,
  'listener must validate VAULT_ADDRESS during startup',
);
assert.doesNotMatch(
  listener,
  /throw new Error\('VAULT_ADDRESS is required'\)/,
  'listener should use the common requireEnv error message for required variables',
);
assert.equal(
  packageJson.scripts['test:listener-env'],
  'node scripts/verify-listener-env-preflight.mjs',
  'package.json must expose listener env preflight regression test',
);
