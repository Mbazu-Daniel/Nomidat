export function getPictureFileError(file: Pick<File, "type" | "size">): string | null {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024 ||
    file.size === 0
  ) {
    return "Choose a JPEG, PNG or WebP picture of at most 10 MB.";
  }
  return null;
}
