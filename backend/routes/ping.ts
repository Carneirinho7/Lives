import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "O LiveLoot não concede pontos por assistir. Confira os pontos oficiais diretamente na Twitch ou na Kick." },
    { status: 410 },
  );
}
