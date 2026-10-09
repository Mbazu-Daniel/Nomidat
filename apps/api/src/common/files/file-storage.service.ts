import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { getR2Config, type ApiEnv, type R2Config } from "../config/env";
import { API_ENV } from "../config/env.module";
import { buildFileKey, encodeFileKey } from "./build-file-key";
import { MAX_READABLE_BYTES, UPLOAD_URL_EXPIRES_IN_SECONDS } from "./files.constants";
import type {
  GenerateUploadUrlRequest,
  GeneratedUploadUrl,
} from "./types/generate-upload-url.type";

/**
 * The one place that hands out upload URLs.
 *
 * Every feature that stores a file — product photography, business logos,
 * avatars — comes through `generateUploadUrl`, so the key layout, the size
 * limit and the expiry are decided once and cannot drift apart per call site.
 *
 * The bytes never touch this process. A presigned URL is returned, the browser
 * PUTs straight to R2, and the caller persists only the key. That keeps large
 * uploads off the API's memory and off its event loop, which is the whole
 * reason for doing it this way rather than accepting a multipart body.
 */
@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private client: S3Client | null = null;

  constructor(@Inject(API_ENV) private readonly env: ApiEnv) {}

  async generateUploadUrl(request: GenerateUploadUrlRequest): Promise<GeneratedUploadUrl> {
    const config = getR2Config(this.env);
    if (!config) {
      // Server misconfiguration, not a caller mistake, so 503 rather than 400.
      // Thrown on call instead of in the constructor so an app with no bucket
      // configured still boots and every other module still works.
      this.logger.error("R2 is not configured; cannot generate an upload URL.");
      throw new ServiceUnavailableException("File storage is not configured.");
    }

    const fileKey = buildFileKey(request.organizationId, request.location, request.fileName);

    try {
      const uploadUrl = await getSignedUrl(
        this.getClient(config),
        new PutObjectCommand({
          Bucket: config.bucketName,
          Key: fileKey,
          ContentType: request.contentType,
          // Signed, not merely checked. R2 rejects an oversized body at the edge,
          // so an unbounded upload never consumes our bandwidth allowance.
          ContentLength: request.contentLength,
        }),
        { expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS },
      );

      return {
        uploadUrl,
        fileKey,
        publicUrl: this.getPublicUrl(fileKey) ?? undefined,
        expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS,
      };
    } catch (cause) {
      this.logger.error(`Failed to generate an upload URL for key ${fileKey}`, cause);
      throw new ServiceUnavailableException("Could not generate an upload URL.");
    }
  }

  /**
   * Turns a stored key into a URL a browser can fetch.
   *
   * Read on every catalog render, so it never signs: a signed URL would expire
   * inside a cached page, and the whole point of storing the key rather than the
   * URL is that this hostname is re-applied at read time. Returns undefined for a
   * missing key or a private bucket, which callers render as a placeholder rather
   * than treating as an error — a product without a picture is ordinary.
   */
  getPublicUrl(fileKey: string | null | undefined): string | null {
    if (!fileKey) return null;
    const publicUrl = getR2Config(this.env)?.publicUrl;
    return publicUrl ? `${publicUrl}/${encodeFileKey(fileKey)}` : null;
  }

  /**
   * Removes the object at a stored key.
   *
   * Exists because every key is unique, so replacing a picture orphans the old
   * object rather than overwriting it. Without this, a seller correcting a photo
   * leaks an object on every change and nothing in the bucket ever shrinks.
   *
   * Silently does nothing for a key outside the caller's organization, so a
   * stale or hostile key cannot delete another business's file. The key is
   * prefixed by the organization it was minted under, so the check is a prefix
   * test rather than a database read.
   */
  async deleteFile(organizationId: string, fileKey: string): Promise<void> {
    const config = getR2Config(this.env);
    if (!config) {
      this.logger.error("R2 is not configured; cannot delete a file.");
      throw new ServiceUnavailableException("File storage is not configured.");
    }

    // Defence in depth. buildFileKey is the only thing that mints a key, so this
    // should be unreachable — but a delete is irreversible and unscoped, so a key
    // that does not start with this organization's own prefix is refused rather
    // than trusted.
    if (!fileKey.startsWith(`${organizationId}/`)) {
      this.logger.warn(
        `Refused to delete key outside the organization: ${fileKey.slice(0, 64)}`,
      );
      return;
    }

    try {
      await this.getClient(config).send(
        new DeleteObjectCommand({ Bucket: config.bucketName, Key: fileKey }),
      );
    } catch (cause) {
      // Reported, not swallowed: the row no longer references the object, so a
      // failure here is only a leaked object, and the caller cannot retry a
      // delete for a key it has already stopped storing.
      this.logger.error(`Failed to delete key ${fileKey}`, cause);
    }
  }

  /**
   * Reads an object's bytes, or null when it is missing.
   *
   * Needed where the bytes have to be embedded rather than linked — a PDF cannot
   * reference a URL and still print offline or from a stored copy. Uses the
   * bucket's own credentials rather than the public hostname, so this works for
   * a private bucket too.
   *
   * Bounded: a logo is a few kilobytes, and an unbounded read of whatever a key
   * points at would let a large object be pulled into this process's memory.
   * Returns null past the cap rather than throwing, so the caller falls back the
   * same way it does for a missing object.
   */
  async getFileBytes(fileKey: string): Promise<Buffer | null> {
    const config = getR2Config(this.env);
    if (!config) {
      this.logger.error("R2 is not configured; cannot read a file.");
      throw new ServiceUnavailableException("File storage is not configured.");
    }

    try {
      const result = await this.getClient(config).send(
        new GetObjectCommand({ Bucket: config.bucketName, Key: fileKey }),
      );
      if (!result.Body) return null;

      const bytes = await result.Body.transformToByteArray();
      if (bytes.byteLength > MAX_READABLE_BYTES) {
        this.logger.warn(`Refusing to read ${fileKey}: larger than the read cap.`);
        return null;
      }
      return Buffer.from(bytes);
    } catch (cause) {
      const name = (cause as { name?: string }).name;
      // A missing object is an ordinary state, not a failure: a logo can be gone
      // because the business removed it, and the caller falls back either way.
      if (name === "NoSuchKey" || name === "NotFound") return null;
      this.logger.error(`Failed to read key ${fileKey}`, cause);
      return null;
    }
  }

  /**
   * R2 ignores S3 bucket ACLs — public access is a bucket-level setting made in
   * the Cloudflare dashboard — so this client sets no ACL and the caller is
   * expected to rely on the bucket's own public hostname.
   */
  private getClient(config: R2Config): S3Client {
    this.client ??= new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
    return this.client;
  }
}
