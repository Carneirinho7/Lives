import { NextResponse } from "next/server";
import { createClient } from "@/frontend/lib/supabase/server";
import { completeMigrationForUser } from "@/backend/legacy-migration";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origem da solicitação inválida." }, { status: 403 });
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
    if (!user.email_confirmed_at) return NextResponse.json({ error: "Confirme seu e-mail para continuar." }, { status: 403 });
    if (!(await completeMigrationForUser(user.id))) {
      return NextResponse.json({ error: "Não foi possível concluir a associação do perfil. Tente novamente." }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível validar seu perfil agora." }, { status: 503 });
  }
}
