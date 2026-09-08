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

function requestIp(req: NextRequest) {
  const raw = req.headers.get("x-vercel-forwarded-for") || req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
  let ip = raw.split(",")[0]?.trim() || "";
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.replace(/:\d+$/, "");
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return null;
  return ip;
}

async function fallbackIpCity(ip: string | null) {
  if (!ip) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json() as { success?: boolean; city?: string; region?: string; country?: string };
    if (data.success === false) return null;
    return {
      city: data.city || null,
      region: data.region || null,
      country: data.country || null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getVisitorContext(req: NextRequest): Promise<VisitorContext> {
  const userAgent = req.headers.get("user-agent") || "";
  const device = detectDevice(userAgent);

  let city = decodeHeader(req.headers.get("x-vercel-ip-city"));
  let country = decodeHeader(req.headers.get("x-vercel-ip-country"));
  let region = decodeHeader(req.headers.get("x-vercel-ip-country-region"));
  let source: VisitorContext["location_source"] = city ? "vercel-ip" : "unavailable";

  // Vercel normally provides city/country headers. If the city header is missing,
  // use the visitor's forwarded public IP with an HTTPS IP-geolocation fallback.
  if (!city) {
    const fallback = await fallbackIpCity(requestIp(req));
    if (fallback?.city) {
      city = fallback.city;
      region = fallback.region || region;
      country = fallback.country || country;
      source = "ipwhois-fallback";
    }
  }

  return {
    city,
    country,
    region,
    location_source: source,
    device_type: device.deviceType,
    browser: device.browser,
    os: device.os,
    user_agent: userAgent,
  };
}
