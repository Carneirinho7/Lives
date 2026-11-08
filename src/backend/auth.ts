import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";

const dataDirectory = join(process.cwd(), "data");
mkdirSync(dataDirectory, { recursive: true });

const globalForAuth = globalThis as typeof globalThis & {
  liveLootAuthDatabase?: DatabaseSync;
};
export const authDatabase = (globalForAuth.liveLootAuthDatabase ??= new DatabaseSync(join(dataDirectory, "liveloot.sqlite")));
authDatabase.exec("PRAGMA journal_mode = WAL");

export const auth = betterAuth({
  appName: "LiveLoot",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: authDatabase,
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
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
  // O primeiro cadastro neste banco vazio é o administrador inicial.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const adminExists = authDatabase
            .prepare("SELECT 1 FROM user WHERE role = 'admin' LIMIT 1")
            .get();
          return { data: { ...user, ...(adminExists ? {} : { role: "admin" }) } };
        },
      },
    },
  },
});
