import { createClient } from "@/frontend/lib/supabase/server";
import { createSupabaseAdminClient } from "@/backend/supabase-admin";
import { findLegacyProfileByEmail, type LegacyProfile } from "@/backend/legacy-profile";

export type AppProfile = {
  id: string;
  full_name: string;
  role: "user" | "admin";
  points_balance: number;
  legacy_user_id: string | null;
};

export class ProfileAccessError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ProfileAccessError";
  }
}

function isLegacyProfile(value: LegacyProfile | null): value is LegacyProfile {
  return value !== null && typeof value.id === "string";
}

export async function getAuthenticatedProfile() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || typeof userId !== "string") return null;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user || user.id !== userId || !user.email) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, points_balance, legacy_user_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw new ProfileAccessError("Não foi possível carregar seu perfil.", 503);
  if (!profile) throw new ProfileAccessError("O perfil da conta ainda não foi criado.", 503);

  if (!profile.legacy_user_id) {
    // The old database only provides a one-time points/profile import. It is
    // not required to serve the authenticated dashboard, so a legacy DB
    // timeout or outage must not make the lives API fail or return an empty
    // serverless response.
    let legacyProfile: LegacyProfile | null = null;
    try {
      legacyProfile = await findLegacyProfileByEmail(user.email);
    } catch (error) {
      console.error("[auth/profile] Optional legacy profile lookup failed", error);
    }
    if (isLegacyProfile(legacyProfile)) {
      if (!user.email_confirmed_at) {
        throw new ProfileAccessError("Confirme seu e-mail antes de migrar seu perfil antigo.", 403);
      }

      let admin;
      try {
        admin = createSupabaseAdminClient();
      } catch {
        throw new ProfileAccessError(
          "A migração segura do perfil antigo ainda não foi configurada no servidor.",
          503,
        );
      }

      const pointsBalance = Number(legacyProfile.pointsBalance);
      const role = legacyProfile.role === "admin" ? "admin" : "user";
      const { data: imported, error: importError } = await admin
        .from("profiles")
        .update({
          full_name: legacyProfile.name.slice(0, 80),
          role,
          points_balance: Number.isSafeInteger(pointsBalance) && pointsBalance >= 0 ? pointsBalance : 0,
          legacy_user_id: legacyProfile.id,
        })
        .eq("id", userId)
        .is("legacy_user_id", null)
        .select("id, full_name, role, points_balance, legacy_user_id")
        .maybeSingle();

      if (importError) throw new ProfileAccessError("Não foi possível migrar seu perfil antigo.", 503);

      if (imported) {
        return { supabase, user, profile: imported as AppProfile };
      }

      // If another request completed the same one-time import, read its result.
      const { data: currentProfile, error: currentError } = await supabase
        .from("profiles")
        .select("id, full_name, role, points_balance, legacy_user_id")
        .eq("id", userId)
        .maybeSingle();
      if (currentError || !currentProfile?.legacy_user_id) {
        throw new ProfileAccessError("Não foi possível confirmar a migração do perfil.", 503);
      }
      return { supabase, user, profile: currentProfile as AppProfile };
    }
  }

  return { supabase, user, profile: profile as AppProfile };
}
