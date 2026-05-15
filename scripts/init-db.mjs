import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const DIRECT_DATABASE_URL_KEYS = [
  'DATABASE_URL',
  'POSTGRES_CONNECTION_STRING',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
];

function firstEnvValue(keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}

function encodeDatabasePathSegment(value) {
  return encodeURIComponent(value).replace(/%2F/g, '/');
}

function resolveDatabaseUrl() {
  const directDatabaseUrl = firstEnvValue(DIRECT_DATABASE_URL_KEYS);
  if (directDatabaseUrl) return directDatabaseUrl;

  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DATABASE || process.env.POSTGRES_DB;
  const username = process.env.POSTGRES_USERNAME || process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;

  if (!host || !database || !username || !password) return undefined;

  return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${encodeDatabasePathSegment(database)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientDatabaseError(output) {
  return output.includes('P1001') || output.includes("Can't reach database server");
}

function writeCommandOutput(result) {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function runPrismaCommand(args, options = {}) {
  return spawnSync(prismaBin, args, {
    env: process.env,
    encoding: 'utf8',
    ...options,
  });
}

function runCompatibilitySql() {
  return runPrismaCommand(['prisma', 'db', 'execute', '--schema', 'prisma/schema.prisma', '--stdin'], {
    input: 'ALTER TABLE IF EXISTS "User" DROP COLUMN IF EXISTS "tgId";\n',
  });
}

const databaseUrl = resolveDatabaseUrl();
if (!databaseUrl) {
  throw new Error(
    'Database connection is required. Set DATABASE_URL, POSTGRES_CONNECTION_STRING, or Zeabur POSTGRES_HOST/POSTGRES_USERNAME/POSTGRES_PASSWORD/POSTGRES_DATABASE environment variables.',
  );
}

process.env.DATABASE_URL = databaseUrl;

const prismaBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const maxAttempts = Number(process.env.INIT_DB_MAX_ATTEMPTS || 30);
const retryDelayMs = Number(process.env.INIT_DB_RETRY_DELAY_MS || 5000);
let attempt = 1;

while (attempt <= maxAttempts) {
  console.log(`🗄️ [DB] Applying web-only compatibility cleanup (attempt ${attempt}/${maxAttempts})`);
  const cleanup = runCompatibilitySql();

  writeCommandOutput(cleanup);
  if (cleanup.error) throw cleanup.error;
  if (cleanup.status !== 0) {
    const output = `${cleanup.stdout || ''}\n${cleanup.stderr || ''}`;
    if (!isTransientDatabaseError(output) || attempt === maxAttempts) {
      process.exit(cleanup.status ?? 1);
    }

    console.warn(`⏳ [DB] Database is not reachable yet. Retrying in ${retryDelayMs}ms...`);
    await sleep(retryDelayMs);
    attempt += 1;
    continue;
  }

  console.log(`🗄️ [DB] Initializing Prisma schema with prisma db push (attempt ${attempt}/${maxAttempts})`);
  const result = runPrismaCommand(['prisma', 'db', 'push', '--skip-generate']);

  writeCommandOutput(result);
  if (result.error) throw result.error;
  if (result.status === 0) process.exit(0);

  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (!isTransientDatabaseError(output) || attempt === maxAttempts) {
    process.exit(result.status ?? 1);
  }

  console.warn(`⏳ [DB] Database is not reachable yet. Retrying in ${retryDelayMs}ms...`);
  await sleep(retryDelayMs);
  attempt += 1;
}
