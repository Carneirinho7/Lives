import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";

const dataDirectory = join(process.cwd(), "data");
mkdirSync(dataDirectory, { recursive: true });
const baseURL = process.env.BETTER_AUTH_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:3000";

const globalForAuth = globalThis as typeof globalThis & {
  liveLootAuthDatabase?: DatabaseSync;
};
export const authDatabase = (globalForAuth.liveLootAuthDatabase ??= new DatabaseSync(join(dataDirectory, "liveloot.sqlite")));
authDatabase.exec("PRAGMA journal_mode = WAL");

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
          const adminExists = authDatabase.prepare("SELECT 1 FROM user WHERE role = 'admin' LIMIT 1").get();
          const shouldBootstrapAdmin = process.env.NODE_ENV !== "production" && !adminExists;
          return { data: { ...user, ...(shouldBootstrapAdmin ? { role: "admin" } : {}) } };
        },
      },
    },
  },
});
