import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

export type LegacyProfile = {
  id: string;
  name: string;
  role: string | null;
  pointsBalance: number;
};

export type LegacyAuthAccount = LegacyProfile & {
  email: string;
  emailVerified: boolean;
  banned: boolean;
  banExpires: Date | string | null;
  passwordHash: string;
};

const runtime = globalThis as typeof globalThis & {
  liveLootLegacyPool?: Pool;
  liveLootLegacySqlite?: import("node:sqlite").DatabaseSync;
};

const databaseUrl = process.env.DATABASE_URL;
const dataDirectory = join(process.cwd(), "data");
const isServerless = Boolean(process.env.VERCEL);

export function isLegacyAuthStorageConfigured() {
  return Boolean(databaseUrl) || (!isServerless && existsSync(join(dataDirectory, "liveloot.sqlite")));
}

if (databaseUrl && !runtime.liveLootLegacyPool) {
  runtime.liveLootLegacyPool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      ca: readFileSync(join(process.cwd(), "supabase", "prod-ca-2021.crt"), "utf8"),
      rejectUnauthorized: true,
    },
    // Legacy-profile import is optional. Keep an unavailable legacy database
    // from stalling serverless dashboard requests.
    connectionTimeoutMillis: 3_000,
    query_timeout: 3_000,
    statement_timeout: 3_000,
    max: isServerless ? 1 : 3,
  });
}

async function getLocalSqlite() {
  if (runtime.liveLootLegacySqlite) return runtime.liveLootLegacySqlite;
  if (isServerless || databaseUrl) return null;

  mkdirSync(dataDirectory, { recursive: true });
  const { DatabaseSync } = await import("node:sqlite");
  runtime.liveLootLegacySqlite = new DatabaseSync(join(dataDirectory, "liveloot.sqlite"));
  return runtime.liveLootLegacySqlite;
}

export async function findLegacyProfileByEmail(email: string): Promise<LegacyProfile | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  if (runtime.liveLootLegacyPool) {
    const result = await runtime.liveLootLegacyPool.query<LegacyProfile>(
      `select id, name, role, coalesce("pointsBalance", 0)::int as "pointsBalance"
       from liveloot."user"
       where lower(email) = $1
       limit 1`,
      [normalizedEmail],
    );
    return result.rows[0] ?? null;
  }

  // Vercel functions have no persistent application directory. Without the
  // legacy DATABASE_URL, skip the optional one-time import instead of trying
  // to create a per-invocation SQLite database in the read-only deployment.
  const sqlite = await getLocalSqlite();
  if (!sqlite) return null;

  const result = sqlite.prepare(
    `select id, name, role, coalesce(pointsBalance, 0) as pointsBalance
     from user where lower(email) = ? limit 1`,
  ).get(normalizedEmail) as LegacyProfile | undefined;

  return result ?? null;
}

export async function findLegacyAuthAccountByEmail(email: string): Promise<LegacyAuthAccount | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  if (runtime.liveLootLegacyPool) {
    const result = await runtime.liveLootLegacyPool.query<LegacyAuthAccount>(
      `select u.id, u.email, u.name, u.role, coalesce(u."pointsBalance", 0)::int as "pointsBalance",
              coalesce(u."emailVerified", false) as "emailVerified",
              coalesce(u.banned, false) as banned, u."banExpires" as "banExpires",
              a.password as "passwordHash"
       from liveloot."user" as u
       join liveloot.account as a on a."userId" = u.id and a."providerId" = 'credential'
       where lower(u.email) = $1
       limit 1`,
      [normalizedEmail],
    );
    return result.rows[0] ?? null;
  }

  const sqlite = await getLocalSqlite();
  if (!sqlite) return null;
  const result = sqlite.prepare(
    `select u.id, u.email, u.name, u.role, coalesce(u.pointsBalance, 0) as pointsBalance,
            coalesce(u.emailVerified, 0) as emailVerified,
            coalesce(u.banned, 0) as banned, u.banExpires as banExpires,
            a.password as passwordHash
     from user as u join account as a on a.userId = u.id and a.providerId = 'credential'
     where lower(u.email) = ? limit 1`,
  ).get(normalizedEmail) as LegacyAuthAccount | undefined;
  return result ?? null;
}

export async function findLegacyProfileById(id: string): Promise<LegacyProfile | null> {
  if (!id || id.length > 128) return null;

  if (runtime.liveLootLegacyPool) {
    const result = await runtime.liveLootLegacyPool.query<LegacyProfile>(
      `select id, name, role, coalesce("pointsBalance", 0)::int as "pointsBalance"
       from liveloot."user" where id = $1 limit 1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  const sqlite = await getLocalSqlite();
  if (!sqlite) return null;
  const result = sqlite.prepare(
    `select id, name, role, coalesce(pointsBalance, 0) as pointsBalance
     from user where id = ? limit 1`,
  ).get(id) as LegacyProfile | undefined;
  return result ?? null;
}
