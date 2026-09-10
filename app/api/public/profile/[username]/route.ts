import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";
import { makeVisitorKey, requestIp } from "@/lib/visitor-context";

export async function GET(req: NextRequest, context: { params: Promise<{ username: string }> }) {
  const { username } = await context.params;
  const admin = serviceSupabase();
  const { data: profile } = await admin
    .from("profiles")
    .select("id,username,display_name,bio,headline,avatar_url,cover_url,role,is_active,is_verified,public_phone,public_email,phone_visible,email_visible,exclusive_price,exclusive_currency,profile_likes_count")
    .eq("username", username)
    .eq("role", "CREATOR")
    .eq("is_active", true)
    .single();
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

  let viewerId: string | null = null;
  let viewerRole: string | null = null;
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (token) {
    const { data: { user } } = await admin.auth.getUser(token);
    if (user) {
      viewerId = user.id;
      const { data: viewerProfile } = await admin.from("profiles").select("role").eq("id", user.id).single();
      viewerRole = viewerProfile?.role || null;
    }
  }

  let unlocked = viewerId === profile.id || viewerRole === "SUPER_ADMIN";
  if (viewerId && !unlocked) {
    const { data: access } = await admin.from("profile_unlocks").select("id").eq("visitor_id", viewerId).eq("creator_id", profile.id).maybeSingle();
    unlocked = Boolean(access);
  }

  const [{ data: media }, { data: reviews }] = await Promise.all([
    admin.from("media").select("*").eq("creator_id", profile.id).order("sort_order").order("created_at", { ascending: true }),
    admin.from("reviews")
      .select("id,reviewer_name,reviewer_first_name,reviewer_last_name,reviewer_avatar_url,rating,review_text,is_featured,created_at,source")
      .eq("creator_id", profile.id)
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const userAgent = req.headers.get("user-agent") || "";
  const anonymousKey = makeVisitorKey(requestIp(req), userAgent);
  const likedIds = new Set<string>();
  const mediaIds = (media || []).map(item => item.id);
  if (mediaIds.length) {
    let query = admin.from("media_likes").select("media_id").in("media_id", mediaIds);
    if (viewerId) query = query.or(`visitor_id.eq.${viewerId},visitor_key.eq.${anonymousKey}`);
    else query = query.eq("visitor_key", anonymousKey);
    const { data: likes } = await query;
    (likes || []).forEach(item => likedIds.add(item.media_id));
  }

  const safeMedia = (media || []).map(item => ({
    ...item,
    likes_count: Number((item as { likes_count?: number }).likes_count || 0),
    liked_by_me: likedIds.has(item.id),
    media_url: item.visibility === "LOCKED" && !unlocked ? null : item.media_url,
    thumbnail_url: item.visibility === "LOCKED" && !unlocked ? null : item.thumbnail_url,
    locked: item.visibility === "LOCKED" && !unlocked,
  }));

  return NextResponse.json({
    profile: {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      bio: profile.bio,
      headline: profile.headline,
      avatar_url: profile.avatar_url,
      cover_url: profile.cover_url,
      is_verified: profile.is_verified,
      public_phone: profile.phone_visible ? profile.public_phone : null,
      public_email: profile.email_visible ? profile.public_email : null,
      exclusive_price: Number(profile.exclusive_price || 0),
      exclusive_currency: profile.exclusive_currency || "USD",
      profile_likes_count: Number(profile.profile_likes_count || 0),
    },
    media: safeMedia,
    reviews: reviews || [],
    unlocked,
  });
}
