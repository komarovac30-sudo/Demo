import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";
import { getVisitorContext } from "@/lib/visitor-context";

function cleanName(value: unknown) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, 60); }

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
    if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const admin = serviceSupabase();
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Your session is not valid." }, { status: 401 });
    const { data: viewer } = await admin.from("profiles").select("id,role").eq("id", user.id).maybeSingle();
    if (!viewer || !["VISITOR", "SUPER_ADMIN"].includes(viewer.role)) return NextResponse.json({ error: "This account cannot submit reviews." }, { status: 403 });

    const body = await req.json();
    const creatorId = String(body.creator_id || "");
    const firstName = cleanName(body.reviewer_first_name);
    const lastName = cleanName(body.reviewer_last_name);
    const rating = Number(body.rating);
    const reviewText = String(body.review_text || "").trim().slice(0, 1200);
    const avatarUrl = body.reviewer_avatar_url ? String(body.reviewer_avatar_url).slice(0, 1000) : null;
    if (!creatorId || !firstName || !lastName || !Number.isInteger(rating) || rating < 1 || rating > 5 || reviewText.length < 10) {
      return NextResponse.json({ error: "First name, last name, 1–5 stars and a review of at least 10 characters are required." }, { status: 400 });
    }
    const { data: creator } = await admin.from("profiles").select("id").eq("id", creatorId).eq("role", "CREATOR").eq("is_active", true).maybeSingle();
    if (!creator) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

    const source = viewer.role === "SUPER_ADMIN" ? "ADMIN" : "VISITOR";
    const status = viewer.role === "SUPER_ADMIN" && body.publish !== false ? "PUBLISHED" : "PENDING";
    if (viewer.role === "VISITOR") {
      const { data: existing } = await admin.from("reviews").select("id,status").eq("creator_id", creatorId).eq("visitor_id", viewer.id).neq("status", "REJECTED").limit(1).maybeSingle();
      if (existing) return NextResponse.json({ error: "You already have a review for this profile. Admin moderation is still in progress or it is already published." }, { status: 409 });
    }

    const reviewerName = `${firstName} ${lastName}`.trim();
    const { data: review, error } = await admin.from("reviews").insert({
      creator_id: creatorId,
      reviewer_name: reviewerName,
      reviewer_first_name: firstName,
      reviewer_last_name: lastName,
      reviewer_avatar_url: avatarUrl,
      rating,
      review_text: reviewText,
      is_featured: false,
      is_published: status === "PUBLISHED",
      status,
      source,
      visitor_id: viewer.role === "VISITOR" ? viewer.id : null,
      created_by: viewer.id,
    }).select("id,status").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (viewer.role === "VISITOR") {
      const context = await getVisitorContext(req);
      await admin.from("activity_events").insert({ profile_id: creatorId, visitor_id: viewer.id, event_type: "REVIEW_SUBMITTED", metadata: { page: "public-profile", ...context } });
    }
    return NextResponse.json({ ok: true, review });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit review." }, { status: 500 });
  }
}
