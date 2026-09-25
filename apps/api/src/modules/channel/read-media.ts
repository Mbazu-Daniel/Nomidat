import { BadRequestException } from "@nestjs/common";

export async function readChannelMedia(response: Response): Promise<Uint8Array> {
  const limit = 10 * 1024 * 1024;
  if (!response.ok || Number(response.headers.get("content-length")) > limit || !response.body) {
    await response.body?.cancel();
    throw new BadRequestException("Media download failed or exceeds 10 MB.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new BadRequestException("Media exceeds 10 MB.");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}
