import { createHash } from "crypto";
import { serviceSupabase } from "@/lib/supabase-service";

type EventMetadata = {
  city?: string | null;
  country?: string | null;
  region?: string | null;
  device_type?: string;
  browser?: string;
  os?: string;
  user_agent?: string;
  ip_address?: string | null;
  visitor_key?: string;
  [key: string]: unknown;
};

export type AnalyticsEvent = {
  id: string;
  profile_id: string;
  visitor_id: string | null;
  media_id: string | null;
  event_type: string;
  metadata: EventMetadata | null;
  created_at: string;
};

export type VisitorSummary = {
  key: string;
  ip_address: string;
  city: string | null;
  country: string | null;
  region: string | null;
  device_type: string;
  browser: string;
  os: string;
  first_seen: string;
  last_seen: string;
  events: number;
  visits: number;
  media_views: number;
  likes: number;
  unlocks: number;
  locked_seen: number;
  active_now: boolean;
  creator_ids: string[];
  creators: string[];
};

export type VisitorTimelineItem = {
  id: string;
  event_type: string;
  created_at: string;
  media_id: string | null;
  media_title: string | null;
  creator_id: string;
  creator_name: string;
};

export type VisitorSession = {
  id: string;
  started_at: string;
  ended_at: string;
  actions: number;
  device_type: string;
  browser: string;
  os: string;
};

function legacyKey(event: AnalyticsEvent) {
  const meta = event.metadata || {};
  if (meta.visitor_key) return String(meta.visitor_key);
  if (meta.ip_address) return createHash("sha256").update(`ip:${String(meta.ip_address)}`).digest("hex").slice(0, 24);
  if (event.visitor_id) return `account-${event.visitor_id}`;
  return createHash("sha256").update([
    meta.user_agent || "legacy",
    meta.city || "",
    meta.country || "",
  ].join("|")).digest("hex").slice(0, 24);
}

function ipLabel(event: AnalyticsEvent) {
  const ip = event.metadata?.ip_address;
  if (typeof ip === "string" && ip.trim()) return ip.trim();
  return event.visitor_id ? "Signed-in visitor" : "Legacy / unavailable IP";
}

function isMediaView(type: string) {
  return ["PHOTO_VIEW", "VIDEO_PLAY", "VIDEO_COMPLETE"].includes(type);
}

function creatorLabel(profileId: string, creatorMap: Map<string, string>) {
  return creatorMap.get(profileId) || "Creator";
}

export function summarizeVisitors(events: AnalyticsEvent[], creatorMap: Map<string, string>) {
  const grouped = new Map<string, AnalyticsEvent[]>();
  for (const event of events) {
    const key = legacyKey(event);
    const rows = grouped.get(key) || [];
    rows.push(event);
    grouped.set(key, rows);
  }

  const now = Date.now();
  const summaries: VisitorSummary[] = [];
  for (const [key, rows] of grouped) {
    const sorted = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const latest = sorted[sorted.length - 1];
    const meta = latest.metadata || {};
    const creatorIds = [...new Set(sorted.map(r => r.profile_id))];
    summaries.push({
      key,
      ip_address: ipLabel(latest),
      city: meta.city ? String(meta.city) : null,
      country: meta.country ? String(meta.country) : null,
      region: meta.region ? String(meta.region) : null,
      device_type: meta.device_type ? String(meta.device_type) : "Unknown device",
      browser: meta.browser ? String(meta.browser) : "Unknown browser",
      os: meta.os ? String(meta.os) : "Unknown OS",
      first_seen: sorted[0].created_at,
      last_seen: latest.created_at,
      events: sorted.length,
      visits: sorted.filter(r => r.event_type === "PROFILE_VIEW").length,
      media_views: sorted.filter(r => isMediaView(r.event_type)).length,
      likes: sorted.filter(r => r.event_type === "MEDIA_LIKE").length - sorted.filter(r => r.event_type === "MEDIA_UNLIKE").length,
      unlocks: sorted.filter(r => r.event_type === "UNLOCK_SUCCESS").length,
      locked_seen: sorted.filter(r => r.event_type === "LOCKED_CONTENT_SEEN").length,
      active_now: now - new Date(latest.created_at).getTime() <= 5 * 60 * 1000,
      creator_ids: creatorIds,
      creators: creatorIds.map(id => creatorLabel(id, creatorMap)),
    });
  }
  return summaries.sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime());
}

export function buildSessions(events: AnalyticsEvent[]): VisitorSession[] {
  const sorted = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const sessions: AnalyticsEvent[][] = [];
  const gapMs = 30 * 60 * 1000;
  for (const event of sorted) {
    const current = sessions[sessions.length - 1];
    if (!current) {
      sessions.push([event]);
      continue;
    }
    const previous = current[current.length - 1];
    if (new Date(event.created_at).getTime() - new Date(previous.created_at).getTime() > gapMs) sessions.push([event]);
    else current.push(event);
  }
  return sessions.reverse().map((rows, index) => {
    const meta = rows[rows.length - 1].metadata || {};
    return {
      id: `session-${sessions.length - index}`,
      started_at: rows[0].created_at,
      ended_at: rows[rows.length - 1].created_at,
      actions: rows.length,
      device_type: meta.device_type ? String(meta.device_type) : "Unknown device",
      browser: meta.browser ? String(meta.browser) : "Unknown browser",
      os: meta.os ? String(meta.os) : "Unknown OS",
    };
  });
}

export async function readVisitorAnalytics(token: string, requestedCreatorId?: string | null) {
  const admin = serviceSupabase();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return { error: "Unauthorized", status: 401 } as const;
  const { data: viewer } = await admin.from("profiles").select("id,role").eq("id", user.id).maybeSingle();
  if (!viewer || !["CREATOR", "SUPER_ADMIN"].includes(viewer.role)) return { error: "Forbidden", status: 403 } as const;

  let creatorId: string | null = null;
  if (viewer.role === "CREATOR") creatorId = viewer.id;
  else if (requestedCreatorId) creatorId = requestedCreatorId;

  let query = admin.from("activity_events")
    .select("id,profile_id,visitor_id,media_id,event_type,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(2500);
  if (creatorId) query = query.eq("profile_id", creatorId);
  const { data: rawEvents, error } = await query;
  if (error) return { error: error.message, status: 500 } as const;
  const events = (rawEvents || []) as AnalyticsEvent[];

  const creatorIds = [...new Set(events.map(e => e.profile_id))];
  const creatorMap = new Map<string, string>();
  if (creatorIds.length) {
    const { data: creators } = await admin.from("profiles").select("id,display_name,username").in("id", creatorIds);
    (creators || []).forEach(c => creatorMap.set(c.id, c.display_name || `@${c.username}`));
  }

  return { admin, viewer, events, creatorMap, status: 200 } as const;
}

export function eventKey(event: AnalyticsEvent) {
  return legacyKey(event);
}
