import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase, verifyRole } from "@/lib/supabase-service";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const caller = await verifyRole(token, "SUPER_ADMIN");
  if (!caller) return NextResponse.json({ error: "Admin authorization required." }, { status: 401 });
  const { id } = await context.params;
  const body = await req.json();
  const status = String(body.status || "");
  if (!["PENDING", "PUBLISHED", "REJECTED"].includes(status)) return NextResponse.json({ error: "Invalid review status." }, { status: 400 });
  const admin = serviceSupabase();
  const { error } = await admin.from("reviews").update({ status, is_published: status === "PUBLISHED" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const caller = await verifyRole(token, "SUPER_ADMIN");
  if (!caller) return NextResponse.json({ error: "Admin authorization required." }, { status: 401 });
  const { id } = await context.params;
  const admin = serviceSupabase();
  const { error } = await admin.from("reviews").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
