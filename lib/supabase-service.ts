import { createClient } from "@supabase/supabase-js";

export function serviceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Supabase server environment variables are missing.");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function verifyRole(token: string, role: "SUPER_ADMIN" | "CREATOR") {
  if (!token) return null;
  const admin = serviceSupabase();
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await admin.from("profiles").select("id,role,username").eq("id", user.id).single();
  if (!profile || profile.role !== role) return null;
  return profile;
}
