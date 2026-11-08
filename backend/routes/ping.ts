import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth, authDatabase } from "@/backend/auth";
import { ensureAuthSchema } from "@/backend/migrations";
import { applyPing } from "@/backend/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await ensureAuthSchema();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Envie um JSON válido." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("streamId" in body)) {
    return NextResponse.json({ error: "streamId é obrigatório." }, { status: 400 });
  }

  const { streamId } = body as { streamId: unknown };
  if (typeof streamId !== "string" || streamId.length > 120) {
    return NextResponse.json({ error: "Identificadores inválidos." }, { status: 400 });
  }

  const result = applyPing(session.user.id, streamId, () => {
    authDatabase.prepare("UPDATE user SET pointsBalance = pointsBalance + 5 WHERE id = ?").run(session.user.id);
    const user = authDatabase.prepare("SELECT pointsBalance FROM user WHERE id = ?").get(session.user.id) as { pointsBalance: number } | undefined;
    if (!user) throw new Error("Usuário da sessão não encontrado.");
    return user.pointsBalance;
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.status === 429 ? { retryAfter: result.retryAfter } : {}) },
      { status: result.status },
    );
  }
  return NextResponse.json({ pointsBalance: result.pointsBalance, awarded: result.awarded });
}
