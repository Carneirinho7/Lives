import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth, authDatabase } from "@/backend/auth";
import { ensureAuthSchema } from "@/backend/migrations";

export const runtime = "nodejs";

function matchesSecret(candidate: string, expected: string) {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  await ensureAuthSchema();
  const origin = request.headers.get("origin");
  const baseURL = process.env.BETTER_AUTH_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:3000";
  if (origin !== new URL(baseURL).origin) {
    return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Entre na sua conta primeiro." }, { status: 401 });
  if (session.user.role === "admin") return NextResponse.json({ ok: true, role: "admin" });

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

  authDatabase.exec("BEGIN IMMEDIATE");
  try {
    const adminExists = authDatabase.prepare("SELECT 1 FROM user WHERE role = 'admin' LIMIT 1").get();
    if (adminExists) {
      authDatabase.exec("ROLLBACK");
      return NextResponse.json({ error: "A conta administradora já foi configurada." }, { status: 409 });
    }
    authDatabase.prepare("UPDATE user SET role = 'admin' WHERE id = ?").run(session.user.id);
    authDatabase.exec("COMMIT");
  } catch (error) {
    authDatabase.exec("ROLLBACK");
    throw error;
  }

  return NextResponse.json({ ok: true, role: "admin" });
}
