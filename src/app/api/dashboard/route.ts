import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/backend/auth";
import { getStreams } from "@/backend/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  return NextResponse.json({ user: session.user, streams: getStreams() });
}
