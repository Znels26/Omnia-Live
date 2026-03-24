import { NextRequest, NextResponse } from "next/server";
// Registration is now handled by Supabase Auth directly on the client.
// This endpoint exists for any server-side post-registration logic if needed.

export async function POST(req: NextRequest) {
  // Supabase Auth handles user creation via supabase.auth.signUp() on the client.
  // Profile creation is handled by the DB trigger on auth.users insert.
  // Token wallet creation is handled by the DB trigger on profiles insert.
  // This route is kept for any custom server-side registration logic.
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    // Any additional server-side registration steps can go here.
    return NextResponse.json({ message: "Registration handled by Supabase Auth." });
  } catch (error) {
    console.error("[Register]", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
