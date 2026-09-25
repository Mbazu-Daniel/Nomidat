export type AiMessage = { role: "assistant" | "user"; content: string };
export type GeminiResponse = { candidates?: { content?: { parts?: { text?: string }[] } }[] };
export type DeepgramResponse = {
  results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
};
