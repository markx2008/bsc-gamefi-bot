import fs from 'node:fs';
import assert from 'node:assert/strict';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const dockerfile = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
const serverTsConfigPath = new URL('../server/tsconfig.json', import.meta.url);

assert.match(
  packageJson.scripts.server,
  /^npm run db:init && node dist\/server\/src\/services\/listener\.js$/,
  'production server script must initialize DB and run compiled JavaScript with node',
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
