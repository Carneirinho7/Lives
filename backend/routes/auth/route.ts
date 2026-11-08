import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/backend/auth";
import { ensureAuthSchema } from "@/backend/migrations";

export const runtime = "nodejs";
const handlers = toNextJsHandler(auth);

export async function GET(request: Request) {
  await ensureAuthSchema();
  return handlers.GET(request);
}

export async function POST(request: Request) {
  await ensureAuthSchema();
  return handlers.POST(request);
}
