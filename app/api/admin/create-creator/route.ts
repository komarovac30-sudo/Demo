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

    // Upsert instead of relying on trigger timing. This makes the new ES profile
    // available to Admin immediately after auth user creation.
    const { data: creator, error: profileError } = await admin.from("profiles").upsert({
      id: data.user.id,
      role: "CREATOR",
      username,
      display_name: displayName,
      headline,
      location_label: null,
      is_verified: false,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" }).select("id,display_name,username,headline,avatar_url,is_active,is_verified,created_at").single();

    if (profileError || !creator) {
      await admin.auth.admin.deleteUser(data.user.id);
      return NextResponse.json({ error: profileError?.message || "Unable to create ES profile." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, userId: data.user.id, creator });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error." }, { status: 500 });
  }
}
