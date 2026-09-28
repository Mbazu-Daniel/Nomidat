import { ServiceUnavailableException } from "@nestjs/common";
import type { ApiEnv } from "../../common/config/env";
import type { AiMessage, GeminiResponse } from "./types";
export async function generateGeminiResponse(env: ApiEnv, system: string, messages: AiMessage[]) {
  if (!env.GEMINI_API_KEY)
    throw new ServiceUnavailableException("GEMINI_API_KEY is not configured.");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": env.GEMINI_API_KEY, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((item) => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.content }],
        })),
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    },
  );
  if (!response.ok) throw new ServiceUnavailableException("Gemini AI processing failed.");
  const body = (await response.json()) as GeminiResponse;
  const raw = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!raw) throw new ServiceUnavailableException("Gemini returned no result.");
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
}
