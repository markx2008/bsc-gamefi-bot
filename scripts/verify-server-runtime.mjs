import fs from 'node:fs';
import assert from 'node:assert/strict';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const dockerfile = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
const serverTsConfigPath = new URL('../server/tsconfig.json', import.meta.url);

assert.equal(
  packageJson.scripts.server,
  'node scripts/start-listener.mjs',
  'production server script must use managed startup wrapper',
);
assert.match(
  fs.readFileSync(new URL('../scripts/start-listener.mjs', import.meta.url), 'utf8'),
  /dist\/server\/server\/src\/services\/listener\.js/,
  'startup wrapper must point to the compiled listener path emitted by server/tsconfig.json',
);
assert.equal(
  packageJson.scripts['server:dev'],
  'ts-node server/src/services/listener.ts',
  'development listener script should keep ts-node for local iteration',
);
assert.equal(
  packageJson.scripts['build:server'],
  'tsc -p server/tsconfig.json',
  'server build script must compile listener TypeScript before runtime',
);
assert.ok(
  packageJson.scripts.build.includes('npm run build:server'),
  'main build must include the server listener build',
);
assert.ok(
  fs.existsSync(serverTsConfigPath),
  'server/tsconfig.json must exist for listener compilation',
);
assert.ok(
  dockerfile.includes('npm prune --omit=dev'),
  'runtime image should prune dev dependencies after building',
);
