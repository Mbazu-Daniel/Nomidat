import { afterEach, describe, it, expect, vi } from "vitest";
import { sendPhoneOTP } from "../send-phone-otp";
import type { ApiEnv } from "../../config/env";
const env = {
  TERMII_API_KEY: "test-only",
  TERMII_SENDER_ID: "Nomidat",
  TERMII_BASE_URL: "https://sms.test",
} as ApiEnv;
const data = { phoneNumber: "+2348012345678", code: "123456" };
afterEach(() => vi.unstubAllGlobals());
describe("phone verification delivery", () => {
  it("refuses missing credentials and insecure providers before sending", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(sendPhoneOTP({ ...env, TERMII_API_KEY: "" }, data)).rejects.toThrow(
      "not configured",
    );
    await expect(
      sendPhoneOTP({ ...env, TERMII_BASE_URL: "http://sms.test" }, data),
    ).rejects.toThrow("HTTPS");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("formats the destination and rejects an unacknowledged delivery", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response('{"message_id":"delivered"}'));
    vi.stubGlobal("fetch", fetch);
    await expect(sendPhoneOTP(env, data)).rejects.toThrow("Could not send");
    await sendPhoneOTP(env, data);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
      to: "2348012345678",
      channel: "dnd",
      type: "plain",
    });
  });
});
