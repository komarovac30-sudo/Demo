import { createHash } from "crypto";
import { NextRequest } from "next/server";

export type VisitorContext = {
  city: string | null;
  country: string | null;
  region: string | null;
  location_source: "vercel-ip" | "ipwhois-fallback" | "unavailable";
  device_type: string;
  browser: string;
  os: string;
  user_agent: string;
  ip_address: string | null;
  visitor_key: string;
};

function decodeHeader(value: string | null) {
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return value; }
}

function detectDevice(userAgent: string) {
  const ua = userAgent.toLowerCase();
  const deviceType = /ipad|tablet/.test(ua) ? "Tablet" : /mobi|android|iphone/.test(ua) ? "Mobile" : "Desktop";
  const browser = /edg\//.test(ua) ? "Edge" : /opr\//.test(ua) ? "Opera" : /chrome\//.test(ua) ? "Chrome" : /safari\//.test(ua) && !/chrome\//.test(ua) ? "Safari" : /firefox\//.test(ua) ? "Firefox" : "Other";
  const os = /iphone|ipad|ios/.test(ua) ? "iOS" : /android/.test(ua) ? "Android" : /windows/.test(ua) ? "Windows" : /mac os|macintosh/.test(ua) ? "macOS" : /linux/.test(ua) ? "Linux" : "Other";
  return { deviceType, browser, os };
}

function normalizeIp(raw: string) {
  let ip = raw.trim();
  if (ip.startsWith("[")) {
    const closing = ip.indexOf("]");
    if (closing > 0) ip = ip.slice(1, closing);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.replace(/:\d+$/, "");
  }
  return ip;
}

export function requestIp(req: NextRequest) {
  const raw = req.headers.get("x-vercel-forwarded-for") || req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
  const ip = normalizeIp(raw.split(",")[0] || "");
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return null;
  return ip;
}

export function makeVisitorKey(ip: string | null, fallbackSeed: string) {
  const seed = ip ? `ip:${ip}` : `fallback:${fallbackSeed}`;
  return createHash("sha256").update(seed).digest("hex").slice(0, 24);
}

async function fallbackIpCity(ip: string | null) {
  if (!ip) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json() as { success?: boolean; city?: string; region?: string; country?: string };
    if (data.success === false) return null;
    return { city: data.city || null, region: data.region || null, country: data.country || null };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getVisitorContext(req: NextRequest): Promise<VisitorContext> {
  const userAgent = req.headers.get("user-agent") || "";
  const device = detectDevice(userAgent);
  const ipAddress = requestIp(req);

  let city = decodeHeader(req.headers.get("x-vercel-ip-city"));
  let country = decodeHeader(req.headers.get("x-vercel-ip-country"));
  let region = decodeHeader(req.headers.get("x-vercel-ip-country-region"));
  let source: VisitorContext["location_source"] = city ? "vercel-ip" : "unavailable";

  if (!city) {
    const fallback = await fallbackIpCity(ipAddress);
    if (fallback?.city) {
      city = fallback.city;
      region = fallback.region || region;
      country = fallback.country || country;
      source = "ipwhois-fallback";
    }
  }

  const fallbackSeed = [userAgent, city || "", region || "", country || ""].join("|");
  return {
    city,
    country,
    region,
    location_source: source,
    device_type: device.deviceType,
    browser: device.browser,
    os: device.os,
    user_agent: userAgent,
    ip_address: ipAddress,
    visitor_key: makeVisitorKey(ipAddress, fallbackSeed),
  };
}
