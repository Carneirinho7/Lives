import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";

const baseURL = process.env.BETTER_AUTH_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:3000";
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL precisa apontar para o PostgreSQL do Supabase em producao.");
}

const dataDirectory = join(process.cwd(), "data");
if (!databaseUrl) mkdirSync(dataDirectory, { recursive: true });
const globalForAuth = globalThis as typeof globalThis & {
  liveLootDatabase?: Pool;
  liveLootLocalDatabase?: DatabaseSync;
};
export const postgresPool = databaseUrl
  ? (globalForAuth.liveLootDatabase ??= new Pool({
      connectionString: databaseUrl,
      ssl: { ca: readFileSync(join(process.cwd(), "supabase", "prod-ca-2021.crt"), "utf8"), rejectUnauthorized: true },
      max: 5,
    }))
  : null;
export const sqliteDatabase = !databaseUrl
  ? (globalForAuth.liveLootLocalDatabase ??= new DatabaseSync(join(dataDirectory, "liveloot.sqlite")))
  : null;
const authDatabase = postgresPool ?? sqliteDatabase!;

export const auth = betterAuth({
  appName: "LiveLoot",
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: authDatabase,
  trustedOrigins: [baseURL],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    requireEmailVerification: false,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
  },
  user: {
    additionalFields: {
      pointsBalance: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false,
        returned: true,
      },
    },
  },
  plugins: [admin({ defaultRole: "user" })],
  // Em desenvolvimento local, o primeiro cadastro é admin. Em produção, o dono
  // reivindica o papel com ADMIN_SETUP_TOKEN para evitar que um visitante chegue primeiro.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const adminExists = postgresPool
            ? (await postgresPool!.query('SELECT 1 FROM liveloot."user" WHERE role = \'admin\' LIMIT 1')).rows.length > 0
            : Boolean(sqliteDatabase!.prepare("SELECT 1 FROM user WHERE role = 'admin' LIMIT 1").get());
          const shouldBootstrapAdmin = process.env.NODE_ENV !== "production" && !adminExists;
          return { data: { ...user, ...(shouldBootstrapAdmin ? { role: "admin" } : {}) } };
        },
      },
    },
  },
});
