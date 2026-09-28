import { afterEach, describe, expect, it, vi } from "vitest";
import { AiService } from "../ai.service";
import type { ApiEnv } from "../../../common/config/env";
const env = {
  AI_PROVIDER: "gemini",
  GEMINI_API_KEY: "gemini-test",
  GEMINI_MODEL: "gemini-test-model",
  TRANSCRIPTION_PROVIDER: "deepgram",
  DEEPGRAM_API_KEY: "deepgram-test",
  DEEPGRAM_MODEL: "nova-3",
  WHISPER_API_KEY: "whisper-test",
  WHISPER_MODEL: "whisper-1",
} as ApiEnv;
afterEach(() => vi.unstubAllGlobals());
describe("merged AI provider selection", () => {
  it("uses Gemini while retaining the current action schema and confirmation instructions", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: '```json\n{"intent":"record_expense","amountNaira":500}\n```' }],
                },
              },
            ],
          }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      new AiService(env).understand([{ role: "user", content: "Fuel 500" }]),
    ).resolves.toEqual({ intent: "record_expense", amountNaira: 500 });
    expect(fetch.mock.calls[0][0]).toContain("gemini-test-model:generateContent");
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.systemInstruction.parts[0].text).toContain(
      "server handles confirmation independently",
    );
    expect(body.contents[0]).toEqual({ role: "user", parts: [{ text: "Fuel 500" }] });
  });
  it("rejects invalid Gemini actions rather than accepting arbitrary provider output", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: '{"intent":"delete_all"}' }] } }],
            }),
          ),
        ),
    );
    await expect(new AiService(env).understand([])).rejects.toThrow("invalid action");
  });
  it("retains Anthropic fallback when Gemini is unavailable", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ content: [{ type: "text", text: '{"intent":"summary"}' }] })),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      new AiService({
        ...env,
        ANTHROPIC_API_KEY: "fallback",
        ANTHROPIC_MODEL: "fallback-model",
      }).understand([]),
    ).resolves.toEqual({ intent: "summary" });
    expect(fetch.mock.calls[1][0]).toBe("https://api.anthropic.com/v1/messages");
  });
  it("selects Deepgram directly and respects the configured model", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            results: { channels: [{ alternatives: [{ transcript: " Paid 500 naira " }] }] },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      new AiService({ ...env, DEEPGRAM_MODEL: "nova-3-general" }).createTranscript(
        new Uint8Array([1]),
        "audio/ogg",
      ),
    ).resolves.toBe("Paid 500 naira");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain("model=nova-3-general");
  });
  it("uses the Whisper credential and model independently of OpenAI chat", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ text: "Sold two bags" })));
    vi.stubGlobal("fetch", fetch);
    await expect(
      new AiService({ ...env, TRANSCRIPTION_PROVIDER: "whisper" }).createTranscript(
        new Uint8Array([1]),
        "audio/webm",
      ),
    ).resolves.toBe("Sold two bags");
    const request = fetch.mock.calls[0][1];
    expect(request.headers.Authorization).toBe("Bearer whisper-test");
    expect(request.body.get("model")).toBe("whisper-1");
    expect(request.body.get("file").name).toBe("voice.webm");
  });
  it("rejects silent or oversized audio before any business action", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ results: { channels: [] } })));
    vi.stubGlobal("fetch", fetch);
    const service = new AiService(env);
    await expect(service.createTranscript(new Uint8Array([1]), "audio/ogg")).rejects.toThrow(
      "No speech",
    );
    await expect(
      service.createTranscript(new Uint8Array(10 * 1024 * 1024 + 1), "audio/ogg"),
    ).rejects.toThrow("at most 10 MB");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
