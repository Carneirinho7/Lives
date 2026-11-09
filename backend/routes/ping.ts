import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/backend/profile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authenticated = await getAuthenticatedProfile();
  if (!authenticated) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Envie um JSON valido." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("streamId" in body)) {
    return NextResponse.json({ error: "streamId e obrigatorio." }, { status: 400 });
  }
  const { streamId } = body as { streamId: unknown };
  if (typeof streamId !== "string" || streamId.length > 120) {
    return NextResponse.json({ error: "Identificadores invalidos." }, { status: 400 });
  }
  if (!/^(twitch|kick)-[a-z0-9_]{1,110}$/.test(streamId)) {
    return NextResponse.json({ error: "Live nao encontrada." }, { status: 404 });
  }

  const { data, error } = await authenticated.supabase.rpc("award_live_points", { p_stream_id: streamId });
  if (error) {
    return NextResponse.json({ error: "Não foi possível registrar os pontos." }, { status: 503 });
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) return NextResponse.json({ error: "Não foi possível registrar os pontos." }, { status: 503 });
  if (result.awarded === 0) {
    return NextResponse.json({ error: "Aguarde para receber os próximos pontos.", retryAfter: result.retry_after }, { status: 429 });
  }
  return NextResponse.json({ pointsBalance: result.points_balance, awarded: result.awarded });
}
