import type { ApiEnv } from "../config/env";
export async function sendPhoneOTP(env: ApiEnv, data: { phoneNumber: string; code: string }) {
  if (!env.TERMII_API_KEY || !env.TERMII_SENDER_ID)
    throw new Error("SMS verification is not configured. Contact your business owner.");
  const url = new URL("/api/sms/send", env.TERMII_BASE_URL);
  if (url.protocol !== "https:") throw new Error("SMS provider must use HTTPS.");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      api_key: env.TERMII_API_KEY,
      to: data.phoneNumber.slice(1),
      from: env.TERMII_SENDER_ID,
      sms: `Your Nomidat verification code is ${data.code}. It expires in 5 minutes. Do not share it.`,
      type: "plain",
      channel: "dnd",
    }),
  });
  const result = (await response.json()) as { message_id?: string };
  if (!response.ok || !result.message_id)
    throw new Error("Could not send verification code. Please try again later.");
}
