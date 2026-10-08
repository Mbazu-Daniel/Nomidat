import type { Database } from "@nomidat/db";
import type { GoogleAuthCredentials } from "./google-auth-credentials.type";

export type CreateBetterAuthOptions = {
  db: Database;
  secret: string;
  baseURL: string;
  /**
   * Every origin the browser may call from. An array, because `localhost`,
   * `127.0.0.1` and a LAN address are three different origins to a browser and
   * all three are the same app.
   */
  webOrigin: string[];
  google?: GoogleAuthCredentials;
  telegramBotToken?: string;
  sendPhoneOTP?: (data: { phoneNumber: string; code: string }) => Promise<void>;
  sendInvitationEmail?: (data: {
    id: string;
    email: string;
    organization: { name: string };
    inviter: { user: { name: string; email: string } };
  }) => Promise<void>;
};
