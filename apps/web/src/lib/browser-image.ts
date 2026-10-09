/** Size cap on the file a seller may pick. Matches the API's MAX_UPLOAD_BYTES. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Longest edge a downsized image is allowed to keep.
 *
 * 240 covers every place these are shown — a settings preview, an invoice header
 * at 160px wide, and a retina display at twice that — without sending a phone
 * camera's full resolution anywhere.
 */
export const MAX_IMAGE_EDGE_PX = 240;

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/**
 * Downsizes a picked image in the browser and returns it as a Blob.
 *
 * The downscale matters for both destinations. A phone camera produces a 12 MP
 * image; a logo is never displayed larger than 160 pixels wide, so uploading the
 * original would put a multi-megabyte object in the bucket for nothing, and
 * storing it inline would bloat every row read.
 *
 * A Blob rather than a data URL because the blob is what an upload takes. A
 * caller that needs inline bytes converts it with `readImageAsDataUrl`.
 */
export async function downscaleImage(file: File, maxEdgePx = MAX_IMAGE_EDGE_PX): Promise<Blob> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number]))
    throw new Error("Choose a PNG, JPEG or WebP image.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Choose an image under 5 MB.");

  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const ratio = Math.min(1, maxEdgePx / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare that image.");

    // PNG keeps its transparency; everything else gets a white matte, because a
    // transparent PNG flattened onto black — the fill colour this replaced — is
    // unreadable.
    const keepTransparency = file.type === "image/png";
    if (!keepTransparency) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, keepTransparency ? "image/png" : "image/jpeg", 0.85),
    );
    if (!blob) throw new Error("Could not prepare that image.");
    return blob;
  } finally {
    image.close();
  }
}

/** Reads a Blob as a data URL, for the destinations that store bytes inline. */
export function readImageAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(blob);
  });
}
