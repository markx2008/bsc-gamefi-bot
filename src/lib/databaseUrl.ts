type DatabaseEnv = NodeJS.ProcessEnv;

const DIRECT_DATABASE_URL_KEYS = [
  'DATABASE_URL',
  'POSTGRES_CONNECTION_STRING',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
];

function firstEnvValue(env: DatabaseEnv, keys: string[]) {
  for (const key of keys) {
    const value = env[key];
    if (value) return value;
  }
  return undefined;
}

function encodeDatabasePathSegment(value: string) {
  return encodeURIComponent(value).replace(/%2F/g, '/');
}

export function resolveDatabaseUrl(env: DatabaseEnv = process.env) {
  const directDatabaseUrl = firstEnvValue(env, DIRECT_DATABASE_URL_KEYS);
  if (directDatabaseUrl) return directDatabaseUrl;

  const host = env.POSTGRES_HOST;
  const port = env.POSTGRES_PORT || '5432';
  const database = env.POSTGRES_DATABASE || env.POSTGRES_DB;
  const username = env.POSTGRES_USERNAME || env.POSTGRES_USER;
  const password = env.POSTGRES_PASSWORD;

  if (!host || !database || !username || !password) return undefined;

  return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${encodeDatabasePathSegment(database)}`;
}

export function ensureDatabaseUrl() {
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error(
      'Database connection is required. Set DATABASE_URL, POSTGRES_CONNECTION_STRING, or Zeabur POSTGRES_HOST/POSTGRES_USERNAME/POSTGRES_PASSWORD/POSTGRES_DATABASE environment variables.',
    );
  }

  process.env.DATABASE_URL = databaseUrl;
  return databaseUrl;
}
