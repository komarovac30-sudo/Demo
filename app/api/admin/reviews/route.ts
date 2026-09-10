import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase, verifyRole } from "@/lib/supabase-service";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const caller = await verifyRole(token, "SUPER_ADMIN");
  if (!caller) return NextResponse.json({ error: "Admin authorization required." }, { status: 401 });

  const admin = serviceSupabase();
  const { data: reviews, error } = await admin
    .from("reviews")
    .select("id,creator_id,reviewer_name,reviewer_first_name,reviewer_last_name,reviewer_avatar_url,rating,review_text,is_featured,is_published,status,source,created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const creatorIds = [...new Set((reviews || []).map((review) => review.creator_id).filter(Boolean))];
  const creatorMap = new Map<string, { display_name: string | null; username: string | null }>();

  if (creatorIds.length) {
    const { data: creators } = await admin
      .from("profiles")
      .select("id,display_name,username")
      .in("id", creatorIds);

    (creators || []).forEach((creator) => {
      creatorMap.set(creator.id, {
        display_name: creator.display_name,
        username: creator.username,
      });
    });
  }

  const enriched = (reviews || []).map((review) => ({
    ...review,
    profiles: creatorMap.get(review.creator_id) || null,
  }));

  return NextResponse.json({ reviews: enriched });
}
