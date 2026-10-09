/**
 * Where an object lives in the bucket. The value is the path segment, so adding
 * a case here is the only change needed to give a feature its own namespace.
 *
 * The key is `{organizationId}/{location}/{unique}-{fileName}`, so the
 * organization already prefixes the object and the segment only has to say which
 * feature it belongs to.
 */
export const FileLocation = {
  /** POS and storefront product photography. */
  PRODUCT_IMAGES: "product-images",
  /** The organization's own logo, on invoices and the storefront. */
  ORGANIZATION_LOGOS: "organization-logos",
  /** A person's picture. */
  AVATARS: "avatars",
} as const;

export type FileLocation = (typeof FileLocation)[keyof typeof FileLocation];
