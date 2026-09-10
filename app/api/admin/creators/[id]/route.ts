import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase, verifyRole } from "@/lib/supabase-service";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const caller = await verifyRole(token, "SUPER_ADMIN");
  if (!caller) return NextResponse.json({ error: "Admin authorization required." }, { status: 401 });
  const { id } = await context.params;
  const body = await req.json();
  const admin = serviceSupabase();
  const update: Record<string, unknown> = {};
  if (typeof body.is_active === "boolean") update.is_active = body.is_active;
  if (typeof body.is_verified === "boolean") update.is_verified = body.is_verified;
  if (!Object.keys(update).length) return NextResponse.json({ error: "No supported fields supplied." }, { status: 400 });
  const { error } = await admin.from("profiles").update(update).eq("id", id).eq("role", "CREATOR");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
