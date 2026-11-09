import "server-only";
import { createSupabaseAdminClient } from "@/backend/supabase-admin";
import { findLegacyAuthAccountByEmail, findLegacyProfileById } from "@/backend/legacy-profile";
import { verifyBetterAuthPassword } from "@/backend/legacy-password";
import { runLegacyMigration } from "@/backend/legacy-migration-core";

const markerKey = "liveloot_legacy_migration";

function migrationMarker(user: { app_metadata?: Record<string, unknown> }, legacyId: string) {
  const marker = user.app_metadata?.[markerKey];
  return marker && typeof marker === "object" && "legacyUserId" in marker && marker.legacyUserId === legacyId;
}

function safePoints(value: number) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

async function findSupabaseUserByEmail(admin: ReturnType<typeof createSupabaseAdminClient>, email: string) {
  // Auth Admin currently exposes paginated listing rather than a server-side email filter.
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
  throw new Error("Supabase user lookup limit reached");
}

async function syncLegacyProfile(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string, legacyId: string) {
  const legacy = await findLegacyProfileById(legacyId);
  if (!legacy) return false;

  const { data: existing, error: readError } = await admin
    .from("profiles")
    .select("id, legacy_user_id, role")
    .eq("id", userId)
    .maybeSingle();
  if (readError || !existing || (existing.legacy_user_id && existing.legacy_user_id !== legacyId)) return false;

  const role = legacy.role === "admin" ? "admin" : "user";
  if (role === "admin") {
    const { data: otherAdmin, error: adminError } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .neq("id", userId)
      .limit(1)
      .maybeSingle();
    if (adminError || otherAdmin) return false;
  }

  let update = admin
    .from("profiles")
    .update({
      full_name: legacy.name.slice(0, 80),
      role,
      points_balance: safePoints(legacy.pointsBalance),
      legacy_user_id: legacyId,
    })
    .eq("id", userId);
  update = existing.legacy_user_id ? update.eq("legacy_user_id", legacyId) : update.is("legacy_user_id", null);
  const { data: updated, error: updateError } = await update
    .select("id")
    .maybeSingle();
  return !updateError && Boolean(updated);
}

async function markMigrationComplete(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string, legacyId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user || !migrationMarker(data.user, legacyId)) return false;
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...data.user.app_metadata,
      [markerKey]: { status: "complete", legacyUserId: legacyId },
    },
  });
  return !updateError;
}

export async function migrateLegacyAccount(email: string, password: string, requestKey: string, appOrigin: string) {
  let admin: ReturnType<typeof createSupabaseAdminClient> | undefined;
  const getAdmin = () => (admin ??= createSupabaseAdminClient());
  return runLegacyMigration(email, password, requestKey, appOrigin, {
    findLegacyAccount: findLegacyAuthAccountByEmail,
    verifyPassword: verifyBetterAuthPassword,
    findSupabaseUser: (normalizedEmail) => findSupabaseUserByEmail(getAdmin(), normalizedEmail),
    createSupabaseUser: async ({ email: normalizedEmail, password: newPassword, emailConfirmed, name, legacyUserId }) => {
      const { data, error } = await getAdmin().auth.admin.createUser({
        email: normalizedEmail,
        password: newPassword,
        email_confirm: emailConfirmed,
        user_metadata: { name },
        app_metadata: { liveloot_legacy_migration: { status: "pending", legacyUserId } },
      });
      return error ? null : data.user;
    },
    syncLegacyProfile: (userId, legacyUserId) => syncLegacyProfile(getAdmin(), userId, legacyUserId),
    markMigrationComplete: (userId, legacyUserId) => markMigrationComplete(getAdmin(), userId, legacyUserId),
    resendConfirmation: async (emailToConfirm, appOrigin) => {
      const { error } = await getAdmin().auth.resend({
        type: "signup",
        email: emailToConfirm,
        options: { emailRedirectTo: `${appOrigin}/auth/confirm?next=/` },
      });
      if (error) throw error;
    },
  });
}

export async function completeMigrationForUser(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data: userResult, error } = await admin.auth.admin.getUserById(userId);
  const user = userResult.user;
  if (error || !user) return false;
  const marker = user.app_metadata?.[markerKey];
  if (!marker || typeof marker !== "object" || !("legacyUserId" in marker) || typeof marker.legacyUserId !== "string") return true;
  const legacyId = marker.legacyUserId;
  if (!(await syncLegacyProfile(admin, userId, legacyId))) return false;
  return markMigrationComplete(admin, userId, legacyId);
}
