export type UploadPurpose = "media" | "profile-avatar" | "profile-cover" | "review-avatar";

type SignResponse = {
  timestamp: number;
  folder: string;
  signature: string;
  cloudName: string;
  apiKey: string;
};

type CloudinaryUploadResult = {
  secure_url: string;
  resource_type: "image" | "video";
  public_id: string;
};

type UploadOptions = {
  onProgress?: (percent: number) => void;
};

function uploadWithProgress(url: string, form: FormData, onProgress?: (percent: number) => void) {
  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";

    xhr.upload.onprogress = event => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onerror = () => reject(new Error("Network error while uploading. Please try again."));
    xhr.onabort = () => reject(new Error("Upload cancelled."));
    xhr.onload = () => {
      const body = xhr.response || {};
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(body?.error?.message || "Cloudinary upload failed."));
        return;
      }
      onProgress?.(100);
      resolve(body as CloudinaryUploadResult);
    };
    xhr.send(form);
  });
}

export async function uploadToCloudinary(
  file: File,
  accessToken: string,
  purpose: UploadPurpose,
  options: UploadOptions = {},
) {
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

  return uploadWithProgress(
    `https://api.cloudinary.com/v1_1/${sign.cloudName}/auto/upload`,
    uploadForm,
    options.onProgress,
  );
}
