export type LegacyMigrationResult = "migrated" | "confirmation_required" | "conflict" | "invalid" | "unavailable";

type LegacyAccount = {
  id: string;
  name: string;
  emailVerified: boolean;
  banned: boolean;
  banExpires: Date | string | null;
  passwordHash: string;
};

type MigrationUser = {
  id: string;
  email_confirmed_at?: string | null;
  app_metadata?: Record<string, unknown>;
};

type Dependencies = {
  findLegacyAccount(email: string): Promise<LegacyAccount | null>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  findSupabaseUser(email: string): Promise<MigrationUser | null>;
  createSupabaseUser(input: {
    email: string;
    password: string;
    emailConfirmed: boolean;
    name: string;
    legacyUserId: string;
  }): Promise<MigrationUser | null>;
  syncLegacyProfile(userId: string, legacyUserId: string): Promise<boolean>;
  markMigrationComplete(userId: string, legacyUserId: string): Promise<boolean>;
  resendConfirmation(email: string, appOrigin: string): Promise<void>;
};

const markerKey = "liveloot_legacy_migration";
const runtime = globalThis as typeof globalThis & {
  liveLootMigrationAttempts?: Map<string, number[]>;
  liveLootMigrationBusy?: number;
};

function migrationMarker(user: MigrationUser, legacyId: string) {
  const marker = user.app_metadata?.[markerKey];
  return marker && typeof marker === "object" && "legacyUserId" in marker && marker.legacyUserId === legacyId;
}

function allowAttempt(key: string, now = Date.now()) {
  const attempts = (runtime.liveLootMigrationAttempts ??= new Map<string, number[]>());
  const recent = (attempts.get(key) ?? []).filter((timestamp) => now - timestamp < 15 * 60_000);
  if (recent.length >= 5) {
    attempts.set(key, recent);
    return false;
  }
  recent.push(now);
  attempts.set(key, recent);
  if (attempts.size > 5000) {
    for (const [entry, timestamps] of attempts) {
      if (!timestamps.length || now - timestamps[timestamps.length - 1] >= 15 * 60_000) attempts.delete(entry);
      if (attempts.size <= 4000) break;
    }
  }
  return true;
}

export async function runLegacyMigration(
  emailInput: string,
  password: string,
  requestKey: string,
  appOrigin: string,
  dependencies: Dependencies,
): Promise<LegacyMigrationResult> {
  const email = emailInput.trim().toLowerCase();
  if (!email || email.length > 254 || !password || password.length > 128) return "invalid";
  if ((requestKey !== "unknown" && !allowAttempt(`ip:${requestKey}`)) || !allowAttempt(`email:${email}`)) return "unavailable";
  if ((runtime.liveLootMigrationBusy ?? 0) >= 2) return "unavailable";
  runtime.liveLootMigrationBusy = (runtime.liveLootMigrationBusy ?? 0) + 1;

  try {
    const legacy = await dependencies.findLegacyAccount(email);
    if (!legacy || legacy.banned || (legacy.banExpires && new Date(legacy.banExpires).getTime() > Date.now())) return "invalid";
    if (!(await dependencies.verifyPassword(password, legacy.passwordHash))) return "invalid";

    let supabaseUser = await dependencies.findSupabaseUser(email);
    if (supabaseUser && !migrationMarker(supabaseUser, legacy.id)) return "conflict";

    if (!supabaseUser) {
      supabaseUser = await dependencies.createSupabaseUser({
        email,
        password,
        emailConfirmed: legacy.emailVerified,
        name: legacy.name.slice(0, 80),
        legacyUserId: legacy.id,
      });
      if (!supabaseUser) {
        // A concurrent signup can win creation; resume only an account with our marker.
        supabaseUser = await dependencies.findSupabaseUser(email);
        if (!supabaseUser || !migrationMarker(supabaseUser, legacy.id)) return "conflict";
      }
    }

    if (!(await dependencies.syncLegacyProfile(supabaseUser.id, legacy.id))) return "unavailable";
    if (!(await dependencies.markMigrationComplete(supabaseUser.id, legacy.id))) return "unavailable";

    if (!supabaseUser.email_confirmed_at) {
      await dependencies.resendConfirmation(email, appOrigin);
      return "confirmation_required";
    }
    return "migrated";
  } catch (error) {
    console.error("[auth/legacy-migration] Migration could not be completed", error instanceof Error ? error.name : "unknown error");
    return "unavailable";
  } finally {
    runtime.liveLootMigrationBusy = Math.max(0, (runtime.liveLootMigrationBusy ?? 1) - 1);
  }
}
