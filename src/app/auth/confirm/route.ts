import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/frontend/lib/supabase/server";

function getSafeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  let error: Error | null = null;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType }));
  } else {
    error = new Error("Missing authentication code");
  }

  const redirectUrl = new URL(error ? "/login?auth-error=confirmation" : getSafeNext(searchParams.get("next")), origin);
  const response = NextResponse.redirect(redirectUrl);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
