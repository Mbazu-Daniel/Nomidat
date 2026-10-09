import { useRef, useState } from "react";
import { createApiRequest } from "@/lib/api";
import { uploadToBucket } from "@/lib/upload-to-bucket";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/browser-image";

export interface ProductImageUploaderProps {
  organizationId: string;
  productId: string;
  /** Current picture, or null when the product has none. */
  imageUrl: string | null;
  /**
   * Called with the new image URL, or with null when the picture was cleared, so
   * the caller can refresh the record. The upload itself is two steps the editor
   * cannot see through: mint a URL, PUT the bytes to it, then save the key the
   * API returned.
   */
  onSaved: () => void;
}

/**
 * Attaches a picture to a product.
 *
 * The bytes go straight to R2 rather than through the API: the editor asks for a
 * presigned URL, PUTs the file to it, then saves the returned key on the product.
 * Uploading through a form would push every product photo through this process's
 * memory for no benefit.
 *
 * The order matters. The key is saved only after the PUT succeeds, so a failed
 * upload cannot leave a product pointing at an object that was never written. The
 * reverse — saving the key first — would render a broken image on the till until
 * someone noticed.
 */
/**
 * The types the API accepts. Checked here too so an unusable file is refused
 * before a round trip, but the API enforces it again — this is a courtesy, not the
 * control.
 */
function isAllowedType(type: string): type is (typeof ALLOWED_IMAGE_TYPES)[number] {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
}

export function ProductImageUploader({
  organizationId,
  productId,
  imageUrl,
  onSaved,
}: ProductImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(imageUrl);

  async function upload(file: File) {
    setError(null);

    if (!isAllowedType(file.type)) {
      setError("Use a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That image is larger than 5 MB.");
      return;
    }

    setBusy(true);
    // Shown straight away so the seller sees the photo they chose rather than
    // waiting on two round trips. Replaced by the saved URL on success, and
    // dropped on failure so a rejected image does not linger as a lie.
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    try {
      // Sign, upload, save the key. Saving first would leave the product pointing
      // at an object that was never written.
      const { fileKey, publicUrl } = await uploadToBucket(
        organizationId,
        file,
        "product-images",
        file.name,
      );

      await createApiRequest(`/organizations/${organizationId}/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ imageKey: fileKey }),
      });

      setPreview(publicUrl ?? null);
      onSaved();
    } catch (reason) {
      setPreview(imageUrl);
      setError(reason instanceof Error ? reason.message : "Could not upload that image.");
    } finally {
      URL.revokeObjectURL(objectUrl);
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(null);
    try {
      // null rather than an empty string: the API reads null as "clear it" and an
      // absent field as "leave it alone", so an empty string would do neither.
      await createApiRequest(`/organizations/${organizationId}/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ imageKey: null }),
      });
      setPreview(null);
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove that image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-product-image">
      <h3>Picture</h3>
      {preview ? (
        <img className="workspace-product-image-preview" src={preview} alt="" />
      ) : (
        <p>No picture. The till shows a placeholder until one is set.</p>
      )}
      <div className="workspace-actions">
        <button
          type="button"
          className="workspace-secondary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {preview ? "Replace picture" : "Upload picture"}
        </button>
        {preview && (
          <button type="button" className="workspace-secondary" disabled={busy} onClick={clear}>
            Remove picture
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so picking the same file twice in a row still fires onChange.
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      {error && <p className="workspace-error">{error}</p>}
    </div>
  );
}
