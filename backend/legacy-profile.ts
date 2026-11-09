import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";

export type LegacyProfile = {
  id: string;
  name: string;
  role: string | null;
  pointsBalance: number;
};

const runtime = globalThis as typeof globalThis & {
  liveLootLegacyPool?: Pool;
  liveLootLegacySqlite?: DatabaseSync;
};

const databaseUrl = process.env.DATABASE_URL;
const dataDirectory = join(process.cwd(), "data");

if (databaseUrl && !runtime.liveLootLegacyPool) {
  runtime.liveLootLegacyPool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      ca: readFileSync(join(process.cwd(), "supabase", "prod-ca-2021.crt"), "utf8"),
      rejectUnauthorized: true,
    },
    max: 3,
  });
} else if (!databaseUrl && !runtime.liveLootLegacySqlite) {
  mkdirSync(dataDirectory, { recursive: true });
  runtime.liveLootLegacySqlite = new DatabaseSync(join(dataDirectory, "liveloot.sqlite"));
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

  const result = runtime.liveLootLegacySqlite!.prepare(
    `select id, name, role, coalesce(pointsBalance, 0) as pointsBalance
     from user where lower(email) = ? limit 1`,
  ).get(normalizedEmail) as LegacyProfile | undefined;

  return result ?? null;
}
