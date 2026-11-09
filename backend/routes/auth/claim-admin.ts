import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedProfile, ProfileAccessError } from "@/backend/profile";
import { createSupabaseAdminClient } from "@/backend/supabase-admin";

export const runtime = "nodejs";

function matchesSecret(candidate: string, expected: string) {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const baseURL = process.env.BETTER_AUTH_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:3000";
  if (origin !== new URL(baseURL).origin) {
    return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }

  let authenticated;
  try {
    authenticated = await getAuthenticatedProfile();
  } catch (error) {
    if (error instanceof ProfileAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
  if (!authenticated) return NextResponse.json({ error: "Entre na sua conta primeiro." }, { status: 401 });
  if (authenticated.profile.role === "admin") return NextResponse.json({ ok: true, role: "admin" });

  const expected = process.env.ADMIN_SETUP_TOKEN;
  if (!expected) return NextResponse.json({ error: "Código de configuração não está habilitado." }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Envie o código de configuração." }, { status: 400 });
  }
  const token = body && typeof body === "object" && "token" in body ? body.token : null;
  if (typeof token !== "string" || !matchesSecret(token, expected)) {
    return NextResponse.json({ error: "Código de configuração incorreto." }, { status: 403 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "A chave administrativa do Supabase não está configurada no servidor." }, { status: 503 });
  }

  const { data: existingAdmin, error: lookupError } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Não foi possível verificar o administrador." }, { status: 503 });
  if (existingAdmin) return NextResponse.json({ error: "A conta administradora já foi configurada." }, { status: 409 });

  const { error: updateError } = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", authenticated.user.id)
    .eq("role", "user");
  if (updateError) {
    if (updateError.code === "23505") {
      return NextResponse.json({ error: "A conta administradora já foi configurada." }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível ativar o administrador." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, role: "admin" });
}
