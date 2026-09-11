import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase, verifyRole } from "@/lib/supabase-service";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
    const caller = await verifyRole(token, "SUPER_ADMIN");
    if (!caller) return NextResponse.json({ error: "Admin authorization required." }, { status: 401 });

    const { id } = await context.params;
    const body = await req.json();
    const status = String(body.status || "");
    if (!["PENDING", "PUBLISHED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Invalid review status." }, { status: 400 });
    }

    const admin = serviceSupabase();
    const payload = {
      status,
      is_published: status === "PUBLISHED",
      verified_at: status === "PUBLISHED" ? new Date().toISOString() : null,
      verified_by: status === "PUBLISHED" ? caller.id : null,
    };
    const { data: review, error } = await admin
      .from("reviews")
      .update(payload)
      .eq("id", id)
      .select("id,status,is_published,verified_at")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });
    return NextResponse.json({ ok: true, review });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update review." }, { status: 500 });
  }
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
