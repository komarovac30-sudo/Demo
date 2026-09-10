import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";
import { getVisitorContext } from "@/lib/visitor-context";

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
    if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const admin = serviceSupabase();
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Your session is not valid." }, { status: 401 });

    const { data: visitor } = await admin.from("profiles").select("id,role").eq("id", user.id).maybeSingle();
    if (!visitor || visitor.role !== "VISITOR") {
      return NextResponse.json({ error: "A visitor account is required for demo checkout." }, { status: 403 });
    }

    const body = await req.json();
    const creatorId = String(body.creator_id || "");
    const { data: creator } = await admin
      .from("profiles")
      .select("id,exclusive_price,exclusive_currency")
      .eq("id", creatorId)
      .eq("role", "CREATOR")
      .eq("is_active", true)
      .maybeSingle();

    if (!creator) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

    const { data: existingUnlock } = await admin
      .from("profile_unlocks")
      .select("id,payment_id")
      .eq("visitor_id", user.id)
      .eq("creator_id", creatorId)
      .maybeSingle();

    let paymentId: string | null = existingUnlock?.payment_id || null;

    if (!existingUnlock) {
      const { data: previousPayment } = await admin
        .from("payments")
        .select("id")
        .eq("visitor_id", user.id)
        .eq("creator_id", creatorId)
        .eq("status", "CONFIRMED")
        .eq("access_scope", "CREATOR_LIBRARY")
        .maybeSingle();

      paymentId = previousPayment?.id || null;

      if (!paymentId) {
        const reference = `DEMO-${randomUUID().slice(0, 8).toUpperCase()}`;
        const { data: payment, error: paymentError } = await admin
          .from("payments")
          .insert({
            visitor_id: user.id,
            creator_id: creatorId,
            amount: Number(creator.exclusive_price || 0),
            currency: creator.exclusive_currency || "USD",
            provider: "DEMO_CHECKOUT",
            provider_reference: reference,
            status: "CONFIRMED",
            access_scope: "CREATOR_LIBRARY",
            confirmed_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 400 });
        paymentId = payment?.id || null;
      }

      const { error: unlockError } = await admin
        .from("profile_unlocks")
        .upsert(
          {
            visitor_id: user.id,
            creator_id: creatorId,
            payment_id: paymentId,
            access_scope: "CREATOR_LIBRARY",
          },
          { onConflict: "visitor_id,creator_id" },
        );

      if (unlockError) return NextResponse.json({ error: unlockError.message }, { status: 400 });
    }

    const visitorContext = await getVisitorContext(req);
    await admin.from("activity_events").insert([
      {
        profile_id: creatorId,
        visitor_id: user.id,
        event_type: "PAYMENT_SUCCESS",
        metadata: {
          page: "public-profile",
          payment_provider: "DEMO_CHECKOUT",
          payment_id: paymentId,
          demo: true,
          ...visitorContext,
        },
      },
      {
        profile_id: creatorId,
        visitor_id: user.id,
        event_type: "UNLOCK_SUCCESS",
        metadata: {
          page: "public-profile",
          payment_provider: "DEMO_CHECKOUT",
          payment_id: paymentId,
          demo: true,
          ...visitorContext,
        },
      },
    ]);

    return NextResponse.json({ ok: true, demo: true, already_unlocked: Boolean(existingUnlock) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to unlock demo content." }, { status: 500 });
  }
}
