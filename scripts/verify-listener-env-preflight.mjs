import fs from 'node:fs';
import assert from 'node:assert/strict';

const listener = fs
  .readFileSync(new URL('../server/src/services/listener.ts', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.match(
  listener,
  /import \{ ensureDatabaseUrl \} from '..\/..\/..\/src\/lib\/databaseUrl\.js';/,
  'listener must use the shared database URL resolver',
);
assert.match(
  listener,
  /function requireEnv\(name: string\)/,
  'listener must define a reusable required environment variable validator for chain-specific variables',
);
assert.match(
  listener,
  /ensureDatabaseUrl\(\);\nconst VAULT_ADDRESS = requireEnv\('VAULT_ADDRESS'\) as `0x\$\{string\}`/,
  'listener must validate database env and VAULT_ADDRESS during startup',
);
assert.doesNotMatch(
  listener,
  /const DATABASE_URL = requireEnv\('DATABASE_URL'\)/,
  'listener should not require only DATABASE_URL; it must accept Zeabur generated Postgres env vars',
);
assert.equal(
  packageJson.scripts['test:listener-env'],
  'node scripts/verify-listener-env-preflight.mjs',
  'package.json must expose listener env preflight regression test',
);
