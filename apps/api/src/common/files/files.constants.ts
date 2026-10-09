/**
 * What may be uploaded, and how big.
 *
 * Both limits exist at the boundary rather than being left to the provider. A
 * presigned URL is a capability handed to the caller, so an unconstrained one
 * lets anyone with a session store an arbitrary blob under our bucket name and
 * push unbounded bytes at it. R2 enforces the size because it is signed into
 * the URL, not because it is checked afterwards.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Images only. The bucket is served from a public hostname, so anything that a
 * browser will execute in our origin's name — `text/html`, `image/svg+xml` —
 * is refused rather than sanitised. SVG is excluded deliberately: it is a
 * script container, and a logo in PNG covers every case we have.
 */
export const ALLOWED_UPLOAD_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Long enough for `product-image-2026-10-09-abc123.jpg`, short enough to keep keys readable. */
export const MAX_UPLOAD_FILE_NAME_LENGTH = 120;

/**
 * Largest object this process will read into memory.
 *
 * Only reached by the paths that need bytes rather than a URL — embedding a logo
 * into a PDF. Everything else streams or renders from the public hostname, so
 * this is a backstop against pulling an arbitrarily large object into the heap,
 * not a limit on what may be uploaded.
 */
export const MAX_READABLE_BYTES = 5 * 1024 * 1024;

/**
 * How long a generated upload URL stays usable.
 *
 * Short because it is a bearer credential for a specific key: anyone holding it
 * can overwrite that one object until it expires. Ten minutes covers a slow
 * connection and an upload without leaving a week-long window open.
 */
export const UPLOAD_URL_EXPIRES_IN_SECONDS = 600;
