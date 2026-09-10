import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const displayName = String(body.display_name || email.split("@")[0] || "Visitor").trim().slice(0, 80);
    if (!email || password.length < 8) return NextResponse.json({ error: "A valid email and password of at least 8 characters are required." }, { status: 400 });
    const admin = serviceSupabase();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } });
    if (error) {
      const duplicate = /already|registered|exists/i.test(error.message);
      return NextResponse.json({ error: duplicate ? "Account already exists. Please sign in instead." : error.message }, { status: duplicate ? 409 : 400 });
    }
    return NextResponse.json({ ok: true, userId: data.user?.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create visitor account." }, { status: 500 });
  }
}
