import { createApiRequest } from "./api";

/** Where in the bucket a file is stored. Mirrors the API's FileLocation union. */
export type UploadLocation = "product-images" | "organization-logos" | "avatars";

/** What the API hands back so a caller can PUT the bytes and then save the key. */
export type GeneratedUpload = {
  uploadUrl: string;
  fileKey: string;
  publicUrl?: string;
};

/**
 * Asks for a presigned URL, then PUTs the bytes straight to the bucket.
 *
 * Every feature that stores a file does the same two steps, so they share them
 * here rather than each hand-rolling a fetch with the same three subtleties: the
 * declared content type must match the one signed into the URL or R2 refuses the
 * upload, the size must be exact or the signed cap will not match, and the file
 * name has to reach the API so the key stays human-readable.
 *
 * Returns the key, not the URL, because the key is what gets stored. A URL goes
 * stale the moment the public hostname is reconfigured.
 */
export async function uploadToBucket(
  organizationId: string,
  file: Blob,
  location: UploadLocation,
  fileName: string,
): Promise<GeneratedUpload> {
  const generated = await createApiRequest<GeneratedUpload>(
    `/organizations/${organizationId}/files/upload-url`,
    {
      method: "POST",
      body: JSON.stringify({
        location,
        // The blob's own type when it has one. A re-encoded blob from
        // `canvas.toBlob` may not carry a name, so the caller supplies it.
        contentType: file.type || "application/octet-stream",
        contentLength: file.size,
        fileName,
      }),
    },
  );

  const response = await fetch(generated.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!response.ok) throw new Error(`Upload failed (${response.status}).`);

  return generated;
}
