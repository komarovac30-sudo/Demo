import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase, verifyRole } from "@/lib/supabase-service";

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
    const caller = await verifyRole(token, "SUPER_ADMIN");
    if (!caller) return NextResponse.json({ error: "Admin authorization required." }, { status: 401 });

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const username = String(body.username || "").trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
    const displayName = String(body.display_name || "").trim();
    if (!email || password.length < 8 || !username || !displayName) return NextResponse.json({ error: "Name, username, email and an 8+ character password are required." }, { status: 400 });

    const admin = serviceSupabase();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } });
    if (error || !data.user) return NextResponse.json({ error: error?.message || "Unable to create user." }, { status: 400 });

    const { error: profileError } = await admin.from("profiles").update({ role: "CREATOR", username, display_name: displayName }).eq("id", data.user.id);
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
    return NextResponse.json({ ok: true, userId: data.user.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error." }, { status: 500 });
  }
}
