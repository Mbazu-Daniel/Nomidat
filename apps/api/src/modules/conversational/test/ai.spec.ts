import { afterEach, describe, expect, it, vi } from "vitest";
import { AiService } from "../ai.service";
import type { ApiEnv } from "../../../common/config/env";

const env = {
  OPENAI_API_KEY: "test",
  OPENAI_MODEL: "test",
  ANTHROPIC_API_KEY: "fallback",
  ANTHROPIC_MODEL: "test",
  DEEPGRAM_API_KEY: "fallback",
  OPENAI_TRANSCRIPTION_MODEL: "test",
} as ApiEnv;
afterEach(() => vi.unstubAllGlobals());
describe("AI provider fallback", () => {
  it("falls back when the primary times out and validates the returned action", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [{ type: "text", text: '{"intent":"record_expense","amountNaira":500}' }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    const action = await new AiService(env).understand([
      { role: "user", content: "Spent 500 on fuel" },
    ]);
    expect(action).toEqual({ intent: "record_expense", amountNaira: 500 });
    expect(fetch.mock.calls[1][0]).toBe("https://api.anthropic.com/v1/messages");
  });
  it("rejects invalid actions from both providers", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ choices: [{ message: { content: '{"intent":"delete_all"}' } }] }),
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              content: [{ type: "text", text: '{"intent":"record_expense","amountNaira":-50}' }],
            }),
          ),
        ),
    );
    await expect(
      new AiService(env).understand([{ role: "user", content: "test" }]),
    ).rejects.toThrow("invalid action");
  });
  it("transcribes with the fallback after primary transcription fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              results: { channels: [{ alternatives: [{ transcript: "Emeka paid 500 naira" }] }] },
            }),
          ),
        ),
    );
    await expect(
      new AiService(env).createTranscript(new Uint8Array([1, 2]), "audio/webm"),
    ).resolves.toBe("Emeka paid 500 naira");
  });
});
