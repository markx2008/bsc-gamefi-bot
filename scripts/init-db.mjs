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

const databaseUrl = resolveDatabaseUrl();
if (!databaseUrl) {
  throw new Error(
    'Database connection is required. Set DATABASE_URL, POSTGRES_CONNECTION_STRING, or Zeabur POSTGRES_HOST/POSTGRES_USERNAME/POSTGRES_PASSWORD/POSTGRES_DATABASE environment variables.',
  );
}

process.env.DATABASE_URL = databaseUrl;
console.log('🗄️ [DB] Initializing Prisma schema with prisma db push');

const prismaBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(prismaBin, ['prisma', 'db', 'push', '--skip-generate'], {
  env: process.env,
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
