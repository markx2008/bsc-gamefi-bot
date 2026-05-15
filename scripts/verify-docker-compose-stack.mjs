import fs from 'node:fs';
import assert from 'node:assert/strict';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const composePath = new URL('../docker-compose.yml', import.meta.url);
const dockerignorePath = new URL('../.dockerignore', import.meta.url);
const dockerfile = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');

assert.equal(packageJson.scripts['docker:up'], 'docker compose up --build');
assert.equal(packageJson.scripts['docker:down'], 'docker compose down');
assert.equal(packageJson.scripts['docker:logs'], 'docker compose logs -f web listener');
assert.equal(packageJson.scripts['docker:rebuild'], 'docker compose build --no-cache');
assert.equal(packageJson.scripts['test:docker-stack'], 'node scripts/verify-docker-compose-stack.mjs');

assert.ok(fs.existsSync(composePath), 'docker-compose.yml must exist');

const compose = fs.readFileSync(composePath, 'utf8');

assert.match(compose, /postgres:/, 'compose must define a postgres service');
assert.match(compose, /web:/, 'compose must define a web service');
assert.match(compose, /listener:/, 'compose must define a listener service');
assert.match(compose, /npm run start/, 'web service must start the Next app');
assert.match(compose, /npm run server/, 'listener service must start the chain listener');
assert.match(compose, /\$\{POSTGRES_HOST_PORT:-15432\}:5432/, 'postgres host port must be configurable with 15432 default');
assert.match(compose, /\$\{WEB_HOST_PORT:-3000\}:3000/, 'web host port must be configurable with 3000 default');
assert.match(compose, /\$\{LISTENER_HOST_PORT:-3001\}:3001/, 'listener health host port must be configurable with 3001 default');
assert.match(compose, /DATABASE_URL: postgresql:\/\/gamefi:gamefi@postgres:5432\/gamefi/, 'app containers must use the compose database URL');
assert.match(compose, /depends_on:[\s\S]*postgres:[\s\S]*condition: service_healthy/, 'app containers must wait for postgres health');

assert.match(dockerfile, /EXPOSE 3000/, 'Dockerfile must document the web port');

assert.ok(fs.existsSync(dockerignorePath), '.dockerignore must exist');

const dockerignore = fs.readFileSync(dockerignorePath, 'utf8');

assert.match(dockerignore, /^\.env$/m, '.dockerignore must exclude local secrets');
assert.match(dockerignore, /^node_modules$/m, '.dockerignore must exclude host dependencies');
assert.match(dockerignore, /^\.next$/m, '.dockerignore must exclude local Next build output');
