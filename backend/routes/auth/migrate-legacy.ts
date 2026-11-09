import { NextResponse } from "next/server";
import { migrateLegacyAccount } from "@/backend/legacy-migration";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const requestOrigin = new URL(request.url).origin;
  const configuredOrigins = [process.env.NEXT_PUBLIC_SITE_URL, process.env.BETTER_AUTH_URL]
    .filter((value): value is string => Boolean(value))
    .map((value) => new URL(value).origin);
  if (process.env.VERCEL_URL) configuredOrigins.push(`https://${process.env.VERCEL_URL}`);
  if (!origin || origin !== requestOrigin || (configuredOrigins.length > 0 && !configuredOrigins.includes(origin))) {
    return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados de acesso inválidos." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("email" in body) || !("password" in body) || typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Dados de acesso inválidos." }, { status: 400 });
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const requestKey = forwarded || request.headers.get("x-real-ip") || "unknown";
  const result = await migrateLegacyAccount(body.email, body.password, requestKey, requestOrigin);
  if (result === "migrated") return NextResponse.json({ status: result });
  if (result === "confirmation_required") return NextResponse.json({ status: result });
  if (result === "conflict") {
    return NextResponse.json({
      status: result,
      error: "Já existe uma conta do Supabase com este e-mail. A senha dessa conta não foi alterada. Use “Esqueci minha senha” para recuperar o acesso.",
    }, { status: 409 });
  }
  if (result === "invalid") return NextResponse.json({ status: result }, { status: 401 });
  return NextResponse.json({
    status: result,
    error: "Não foi possível concluir a migração agora. Aguarde alguns minutos e tente novamente. Se o problema continuar, fale com o suporte.",
  }, { status: 503, headers: { "Retry-After": "60" } });
}
