import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

export type LegacyProfile = {
  id: string;
  name: string;
  role: string | null;
  pointsBalance: number;
};

const runtime = globalThis as typeof globalThis & {
  liveLootLegacyPool?: Pool;
  liveLootLegacySqlite?: import("node:sqlite").DatabaseSync;
};

const databaseUrl = process.env.DATABASE_URL;
const dataDirectory = join(process.cwd(), "data");
const isServerless = Boolean(process.env.VERCEL);

if (databaseUrl && !runtime.liveLootLegacyPool) {
  runtime.liveLootLegacyPool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      ca: readFileSync(join(process.cwd(), "supabase", "prod-ca-2021.crt"), "utf8"),
      rejectUnauthorized: true,
    },
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
