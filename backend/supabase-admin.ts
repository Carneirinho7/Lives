import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Server-only administrative client. Never import this module from a Client Component. */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("SUPABASE_SECRET_KEY must be configured on the server.");
  }

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
