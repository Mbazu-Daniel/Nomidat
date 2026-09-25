import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import type { ApiEnv } from "../../common/config/env";
import type { DeepgramResponse } from "./types";

/** Selected providers share limits and transcript validation across web and channels. */
export class SpeechTranscriber {
  constructor(private readonly env: ApiEnv) {}
  async transcribe(data: Uint8Array, mimeType: string): Promise<string> {
    const bytes = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
    if (this.env.TRANSCRIPTION_PROVIDER === "deepgram") return this.deepgram(bytes, mimeType);
    if (this.env.TRANSCRIPTION_PROVIDER === "whisper")
      return this.openai(bytes, mimeType, this.env.WHISPER_API_KEY, this.env.WHISPER_MODEL);
    try {
      return await this.openai(
        bytes,
        mimeType,
        this.env.OPENAI_API_KEY,
        this.env.OPENAI_TRANSCRIPTION_MODEL,
      );
    } catch (error) {
      if (!this.env.DEEPGRAM_API_KEY) throw error;
      return this.deepgram(bytes, mimeType);
    }
  }
  private async openai(
    bytes: ArrayBuffer,
    mimeType: string,
    key: string | undefined,
    model: string,
  ) {
    if (!key)
      throw new ServiceUnavailableException("Selected transcription provider is not configured.");
    const form = new FormData();
    const extension = mimeType.includes("mp4") ? "mp4" : mimeType.includes("webm") ? "webm" : "ogg";
    form.append("file", new Blob([bytes], { type: mimeType }), `voice.${extension}`);
    form.append("model", model);
    form.append(
      "prompt",
      "Transcribe faithfully. The speaker may use Nigerian English, Nigerian Pidgin, Yoruba, Igbo, Hausa, or a mixture. Preserve names, numbers, currencies and business terms.",
    );
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new ServiceUnavailableException("Voice transcription failed.");
    const body = (await response.json()) as { text?: string };
    return requireTranscript(body.text);
  }
  private async deepgram(bytes: ArrayBuffer, mimeType: string) {
    if (!this.env.DEEPGRAM_API_KEY)
      throw new ServiceUnavailableException("Deepgram transcription provider is not configured.");
    const model = encodeURIComponent(this.env.DEEPGRAM_MODEL ?? "nova-3");
    const response = await fetch(
      `https://api.deepgram.com/v1/listen?model=${model}&smart_format=true`,
      {
        method: "POST",
        headers: { Authorization: `Token ${this.env.DEEPGRAM_API_KEY}`, "Content-Type": mimeType },
        body: new Blob([bytes], { type: mimeType }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok) throw new ServiceUnavailableException("Deepgram transcription failed.");
    const body = (await response.json()) as DeepgramResponse;
    return requireTranscript(body.results?.channels?.[0]?.alternatives?.[0]?.transcript);
  }
}
function requireTranscript(value: string | undefined) {
  if (!value?.trim()) throw new BadRequestException("No speech was detected in that voice note.");
  return value.trim();
}
