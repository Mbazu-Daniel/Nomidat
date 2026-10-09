import { randomUUID } from "node:crypto";
import { MAX_UPLOAD_FILE_NAME_LENGTH } from "./files.constants";
import type { FileLocation } from "./types/file-location.type";

/**
 * Percent-encodes a key for use in a URL, leaving the separators alone.
 *
 * A key is already safe — separators aside, the leaf is reduced to a conservative
 * character set by `sanitizeFileName` — so this exists for the paths that are not
 * file names. A space or a `#` in a key would otherwise truncate the URL at the
 * fragment marker or arrive percent-encoded, and the browser would 404 on an
 * object that plainly exists.
 */
export function encodeFileKey(fileKey: string): string {
  return fileKey.split("/").map(encodeURIComponent).join("/");
}

/**
 * Builds the bucket key for an upload:
 * `{organizationId}/{location}/{name}-{unique}{extension}`.
 *
 * The file name is attacker-supplied and lands in a key we then build a URL
 * from, so it is reduced to a safe leaf rather than trusted. Anything that could
 * change which prefix the object lands under is removed: path separators would
 * let `../` walk out of the location, and dot segments would collapse the key in
 * tools that display it. Characters that only serve to break a log line or a
 * header are dropped too — a newline in a key is a newline in every log line
 * that mentions it.
 *
 * The organization id and location are not sanitised here: the first is a UUID
 * the caller already proved it owns, and the second is a closed union, so both
 * are structurally incapable of containing a separator.
 *
 * The unique segment is what stops one upload from destroying another. Keyed on
 * the file name alone, a seller re-uploading `photo.jpg` silently overwrites the
 * previous object — and two different products both called `photo.jpg` overwrite
 * each other, which shows one product wearing another's picture. The cost is
 * that a replacement orphans the old object rather than replacing it, so a caller
 * that swaps a picture must delete the key it just replaced.
 */
export function buildFileKey(
  organizationId: string,
  location: FileLocation,
  fileName: string,
): string {
  const leaf = sanitizeFileName(fileName);
  const unique = randomUUID().replace(/-/g, "").slice(0, 12);
  return `${organizationId}/${location}/${unique}-${leaf}`;
}

function sanitizeFileName(fileName: string): string {
  return (
    fileName
      // Separators first, so a traversal string cannot be reassembled later.
      .replace(/[/\\]/g, "-")
      // Control characters, which are the ones that break log lines and headers.
      // oxlint-disable-next-line no-control-regex -- stripping them is the point
      .replace(/[\u0000-\u001f\u007f]/g, "")
      // Anything outside a conservative set is replaced rather than rejected, so
      // a name like `Creme brulee.jpg` survives intact.
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      // Leading dots would hide the object in a bucket listing, and a name that
      // is only dots is not a file.
      .replace(/^\.+/, "")
      .slice(0, MAX_UPLOAD_FILE_NAME_LENGTH)
      .trim() || "file"
  );
}
