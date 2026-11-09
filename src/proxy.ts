import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/frontend/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response, authenticated } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isPublicPage =
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/auth/");
  const isApi = pathname.startsWith("/api/");

  if (!authenticated && !isPublicPage && !isApi) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    response.headers.forEach((value, name) => redirectResponse.headers.set(name, value));
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
