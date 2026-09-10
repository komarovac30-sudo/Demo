export type UploadPurpose = "media" | "profile-avatar" | "profile-cover" | "review-avatar";

type SignResponse = {
  timestamp: number;
  folder: string;
  signature: string;
  cloudName: string;
  apiKey: string;
};

export async function uploadToCloudinary(file: File, accessToken: string, purpose: UploadPurpose) {
  const signRes = await fetch("/api/cloudinary/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ purpose }),
  });
  const sign = (await signRes.json()) as SignResponse & { error?: string };
  if (!signRes.ok) throw new Error(sign.error || "Unable to authorize upload.");

  const uploadForm = new FormData();
  uploadForm.append("file", file);
  uploadForm.append("api_key", sign.apiKey);
  uploadForm.append("timestamp", String(sign.timestamp));
  uploadForm.append("signature", sign.signature);
  uploadForm.append("folder", sign.folder);

  const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/auto/upload`, {
    method: "POST",
    body: uploadForm,
  });
  const cloud = await cloudRes.json();
  if (!cloudRes.ok) throw new Error(cloud.error?.message || "Cloudinary upload failed.");
  return cloud as { secure_url: string; resource_type: "image" | "video"; public_id: string };
}
