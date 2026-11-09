import { createClient } from "@/frontend/lib/supabase/server";

export async function getAuthenticatedSupabaseUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || typeof userId !== "string") return null;
  return { supabase, userId };
}
