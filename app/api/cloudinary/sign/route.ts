import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { serviceSupabase } from "@/lib/supabase-service";

const allowedPurposes = new Set(["media", "profile-avatar", "profile-cover", "review-avatar"]);

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const admin = serviceSupabase();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Your session is not valid." }, { status: 401 });
  const { data: profile } = await admin.from("profiles").select("id,role").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 401 });

  let purpose = "media";
  try {
    const body = await req.json();
    purpose = String(body?.purpose || "media");
  } catch {
    purpose = "media";
  }
  if (!allowedPurposes.has(purpose)) return NextResponse.json({ error: "Unsupported upload purpose." }, { status: 400 });

  if (["media", "profile-avatar", "profile-cover"].includes(purpose) && profile.role !== "CREATOR") {
    return NextResponse.json({ error: "Creator authorization required." }, { status: 403 });
  }
  if (purpose === "review-avatar" && !["VISITOR", "SUPER_ADMIN"].includes(profile.role)) {
    return NextResponse.json({ error: "This account cannot upload review images." }, { status: 403 });
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return NextResponse.json({ error: "Cloudinary environment variables are missing." }, { status: 500 });

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `veloura-demo/${purpose}/${profile.id}`;
  const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, apiSecret);
  return NextResponse.json({ timestamp, folder, signature, cloudName, apiKey });
}
