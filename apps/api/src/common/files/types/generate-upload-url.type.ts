import type { FileLocation } from "./file-location.type";

/**
 * One upload request. Deliberately not carrying an organization id: the caller
 * passes the id it was authorized for, so a handler cannot ask for a key under
 * an organization it was not scoped to.
 */
export interface GenerateUploadUrlRequest {
  organizationId: string;
  location: FileLocation;
  fileName: string;
  contentType: string;
  contentLength: number;
}

/** What the caller needs to PUT the bytes and then read them back. */
export interface GeneratedUploadUrl {
  /** Presigned R2 endpoint. Sent as a PUT, never used to read. */
  uploadUrl: string;
  /** Stable key, persisted on the row that owns the file. */
  fileKey: string;
  /** Public read URL, or absent when the bucket has no public hostname. */
  publicUrl?: string;
  expiresIn: number;
}
