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
    const username = String(body.username || "").trim().toLowerCase();
    const displayName = String(body.display_name || "").trim().slice(0, 80);
    const headline = String(body.headline || "").trim().slice(0, 120) || null;
    const locationLabel = String(body.location_label || "").trim().slice(0, 120) || null;

    if (!email || password.length < 8 || !displayName || !/^[a-z0-9_.]{3,40}$/.test(username)) {
      return NextResponse.json({ error: "Name, email, an 8+ character password, and a 3–40 character username using letters, numbers, dot or underscore are required." }, { status: 400 });
    }

    const admin = serviceSupabase();
    const { data: existingUsername } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
    if (existingUsername) return NextResponse.json({ error: "That username is already in use." }, { status: 409 });

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    if (error || !data.user) return NextResponse.json({ error: error?.message || "Unable to create user." }, { status: 400 });

    const { error: profileError } = await admin.from("profiles").update({
      role: "CREATOR",
      username,
      display_name: displayName,
      headline,
      location_label: locationLabel,
      is_verified: false,
    }).eq("id", data.user.id);

    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, userId: data.user.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error." }, { status: 500 });
  }
}
