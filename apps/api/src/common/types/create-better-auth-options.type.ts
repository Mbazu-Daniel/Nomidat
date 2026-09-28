import type { Database } from "@nomidat/db";
import type { GoogleAuthCredentials } from "./google-auth-credentials.type";

export type CreateBetterAuthOptions = {
  db: Database;
  secret: string;
  baseURL: string;
  webOrigin: string;
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
