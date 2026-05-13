import fs from 'node:fs';
import assert from 'node:assert/strict';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const databaseUrlSource = fs
  .readFileSync(new URL('../src/lib/databaseUrl.ts', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');
const prismaSource = fs
  .readFileSync(new URL('../src/lib/prisma.ts', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');
const initDbSource = fs
  .readFileSync(new URL('../scripts/init-db.mjs', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');
const apiFiles = [
  '../src/app/api/auth/telegram/route.ts',
  '../src/app/api/auth/bind-wallet/route.ts',
  '../src/app/api/withdrawals/route.ts',
  '../src/app/api/admin/withdrawals/[id]/approve/route.ts',
  '../src/app/api/admin/withdrawals/[id]/reject/route.ts',
];

assert.match(databaseUrlSource, /POSTGRES_CONNECTION_STRING/, 'database URL resolver must support Zeabur POSTGRES_CONNECTION_STRING');
assert.match(databaseUrlSource, /POSTGRES_HOST/, 'database URL resolver must support split Zeabur POSTGRES_HOST');
assert.match(databaseUrlSource, /POSTGRES_DATABASE|POSTGRES_DB/, 'database URL resolver must support split database name variables');
assert.match(databaseUrlSource, /POSTGRES_USERNAME|POSTGRES_USER/, 'database URL resolver must support split username variables');
assert.match(databaseUrlSource, /process\.env\.DATABASE_URL = databaseUrl/, 'resolver must populate DATABASE_URL for Prisma');
assert.match(prismaSource, /ensureDatabaseUrl\(\);/, 'Prisma client helper must resolve DB env lazily at request runtime');

for (const file of apiFiles) {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(source, /import \{ getPrisma \} from "@\/lib\/prisma";/, `${file} must use shared lazy Prisma helper`);
  assert.match(source, /const prisma = getPrisma\(\);/, `${file} must construct Prisma lazily inside handler`);
  assert.doesNotMatch(source, /ensureDatabaseUrl\(\);\n\nconst prisma = new PrismaClient\(\);/, `${file} must not resolve DB env at module evaluation time`);
}

const listener = fs
  .readFileSync(new URL('../server/src/services/listener.ts', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');
assert.match(listener, /ensureDatabaseUrl\(\);\nconst VAULT_ADDRESS/, 'listener must resolve DB env before PrismaClient construction');

assert.equal(packageJson.scripts['db:init'], 'node scripts/init-db.mjs', 'db:init script must initialize Prisma schema');
assert.match(packageJson.scripts.start, /^npm run db:init && /, 'web start must initialize DB before Next starts');
assert.equal(packageJson.scripts.server, 'node scripts/start-listener.mjs', 'listener server must use startup wrapper that initializes DB before launching listener');
assert.ok(packageJson.dependencies.prisma, 'Prisma CLI must be available at runtime for db:init');
assert.match(initDbSource, /prisma db push/, 'init-db script must run prisma db push');
assert.match(initDbSource, /INIT_DB_MAX_ATTEMPTS/, 'init-db script must allow configurable retry attempts');
assert.match(initDbSource, /INIT_DB_RETRY_DELAY_MS/, 'init-db script must allow configurable retry delay');
assert.match(initDbSource, /P1001|Can't reach database server/, 'init-db script must retry transient database connectivity errors');
assert.match(initDbSource, /while \(attempt <= maxAttempts\)/, 'init-db script must retry db push before failing');
