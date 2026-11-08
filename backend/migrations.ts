import { getMigrations } from "better-auth/db/migration";
import { auth } from "@/backend/auth";

const migrationRuntime = globalThis as typeof globalThis & {
  liveLootAuthMigration?: Promise<void>;
};

// O primeiro request aplica tabelas novas no volume persistente antes de atender auth.
export function ensureAuthSchema() {
  return (migrationRuntime.liveLootAuthMigration ??= getMigrations(auth.options).then(({ runMigrations }) => runMigrations()));
}
