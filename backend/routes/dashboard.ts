import { NextResponse } from "next/server";
import { getAuthenticatedProfile, ProfileAccessError } from "@/backend/profile";
import { getStreams } from "@/backend/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const authenticated = await getAuthenticatedProfile();
    if (!authenticated) return NextResponse.json({ error: "Entre na sua conta para continuar." }, { status: 401 });

    const { user, profile } = authenticated;
    return NextResponse.json({
      user: {
        id: user.id,
        name: profile.full_name || user.user_metadata.name || user.email,
        email: user.email,
        role: profile.role,
        pointsBalance: profile.points_balance,
      },
      streams: getStreams(),
    });
  } catch (error) {
    if (error instanceof ProfileAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
