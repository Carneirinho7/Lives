import { NextResponse } from "next/server";

export const runtime = "nodejs";

function legacyAuthDisabled() {
  return process.env.LEGACY_BETTER_AUTH_ENABLED !== "true";
}

async function handleLegacyAuth(request: Request, method: "GET" | "POST") {
  if (legacyAuthDisabled()) return new NextResponse(null, { status: 404 });
  const [{ auth }, { toNextJsHandler }, { ensureAuthSchema }] = await Promise.all([
    import("@/backend/auth"),
    import("better-auth/next-js"),
    import("@/backend/migrations"),
  ]);
  const handlers = toNextJsHandler(auth);
  await ensureAuthSchema();
  return handlers[method](request);
}

export const GET = (request: Request) => handleLegacyAuth(request, "GET");
export const POST = (request: Request) => handleLegacyAuth(request, "POST");
