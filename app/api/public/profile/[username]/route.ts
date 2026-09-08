import { NextRequest, NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-service";

export async function GET(req: NextRequest, context: { params: Promise<{ username: string }> }) {
  const { username } = await context.params;
  const admin = serviceSupabase();
  const { data: profile } = await admin.from("profiles").select("id,username,display_name,bio,avatar_url,cover_url,role,is_active").eq("username", username).eq("role", "CREATOR").eq("is_active", true).single();
  if (!profile) return NextResponse.json({ error: "Creator not found." }, { status: 404 });

  let viewerId: string | null = null; let viewerRole: string | null = null;
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
    admin.from("media").select("id,type,visibility,title,media_url,thumbnail_url,sort_order,created_at").eq("creator_id", profile.id).order("sort_order").order("created_at", { ascending: true }),
    admin.from("reviews").select("id,reviewer_name,rating,review_text,is_featured,created_at").eq("creator_id", profile.id).eq("is_published", true).order("is_featured", { ascending: false }).order("created_at", { ascending: false }),
  ]);

  const safeMedia = (media || []).map(item => ({ ...item, media_url: item.visibility === "LOCKED" && !unlocked ? null : item.media_url, thumbnail_url: item.visibility === "LOCKED" && !unlocked ? null : item.thumbnail_url, locked: item.visibility === "LOCKED" && !unlocked }));
  return NextResponse.json({ profile: { id: profile.id, username: profile.username, display_name: profile.display_name, bio: profile.bio, avatar_url: profile.avatar_url, cover_url: profile.cover_url }, media: safeMedia, reviews: reviews || [], unlocked });
}
