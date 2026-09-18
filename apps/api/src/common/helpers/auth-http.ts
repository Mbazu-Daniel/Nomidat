import type { Request, Response as ExpressResponse } from "express";

export function extractHeaders(req: Request): Headers {
  const headers = new globalThis.Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
    }
  }
  return headers;
}

const FALLBACK_ERROR_MESSAGE = "Something went wrong. Please try again.";

interface MappedAuthError {
  status: number;
  message: string;
}

// Internal better-auth `code` values are never exposed to clients. Known codes
// get our own message (and a corrected HTTP status); anything unknown falls
// back to the upstream message with its `code` stripped.
const AUTH_ERROR_MESSAGES: Record<string, MappedAuthError> = {
  // sign-up / sign-in
  USER_ALREADY_EXISTS: { status: 409, message: "An account with this email already exists." },
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: {
    status: 409,
    message: "An account with this email already exists.",
  },
  INVALID_EMAIL_OR_PASSWORD: { status: 401, message: "Invalid email or password." },
  INVALID_EMAIL: { status: 400, message: "Please enter a valid email address." },
  INVALID_PASSWORD: { status: 400, message: "Please enter a valid password." },
  PASSWORD_TOO_SHORT: { status: 400, message: "Password is too short." },
  PASSWORD_TOO_LONG: { status: 400, message: "Password is too long." },
  USER_NOT_FOUND: { status: 401, message: "Invalid email or password." },
  USER_EMAIL_NOT_FOUND: { status: 401, message: "Invalid email or password." },
  CREDENTIAL_ACCOUNT_NOT_FOUND: { status: 401, message: "Invalid email or password." },
  EMAIL_NOT_VERIFIED: { status: 403, message: "Please verify your email before signing in." },
  BANNED_USER: { status: 403, message: "This account has been disabled." },
  SESSION_EXPIRED: { status: 401, message: "Your session has expired. Please sign in again." },
  FAILED_TO_GET_SESSION: { status: 401, message: "Your session has expired. Please sign in again." },
  INVALID_TOKEN: { status: 400, message: "This link is invalid or has expired. Please request a new one." },
  TOKEN_EXPIRED: { status: 400, message: "This link has expired. Please request a new one." },
  FAILED_TO_CREATE_USER: { status: 500, message: FALLBACK_ERROR_MESSAGE },
  FAILED_TO_CREATE_SESSION: { status: 500, message: FALLBACK_ERROR_MESSAGE },
  FAILED_TO_UPDATE_USER: { status: 500, message: FALLBACK_ERROR_MESSAGE },
  INTERNAL_SERVER_ERROR: { status: 500, message: FALLBACK_ERROR_MESSAGE },
  // social
  SOCIAL_ACCOUNT_ALREADY_LINKED: {
    status: 409,
    message: "This social account is already linked to another user.",
  },
  PROVIDER_NOT_FOUND: { status: 400, message: "This sign-in method is currently unavailable." },
  PROVIDER_NOT_CONFIGURED: { status: 400, message: "This sign-in method is currently unavailable." },
  PROVIDER_NOT_SUPPORTED: { status: 400, message: "This sign-in method is currently unavailable." },
  FAILED_TO_GET_USER_INFO: { status: 400, message: "Could not sign you in with this provider." },
  ACCOUNT_NOT_FOUND: { status: 401, message: "Could not sign you in with this provider." },
  // organization / member / invitation
  ORGANIZATION_NOT_FOUND: { status: 404, message: "Organization not found." },
  MEMBER_NOT_FOUND: { status: 404, message: "Member not found." },
  INVITATION_NOT_FOUND: { status: 404, message: "Invitation not found or already used." },
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: {
    status: 409,
    message: "This user is already a member of the organization.",
  },
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: {
    status: 409,
    message: "This user has already been invited.",
  },
  INVITATION_LIMIT_REACHED: { status: 403, message: "The invitation limit has been reached." },
  YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS: {
    status: 403,
    message: "You have reached the maximum number of organizations.",
  },
  NO_ACTIVE_ORGANIZATION: { status: 400, message: "No active organization selected." },
  YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION: {
    status: 403,
    message: "You don't have access to this organization.",
  },
  YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION: {
    status: 403,
    message: "You don't have access to this organization.",
  },
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION: {
    status: 403,
    message: "You don't have permission to invite members.",
  },
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: {
    status: 403,
    message: "This invitation was sent to someone else.",
  },
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: {
    status: 400,
    message: "You can't leave the organization as its only owner.",
  },
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: {
    status: 400,
    message: "You can't leave the organization without an owner.",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeAuthError(payload: unknown, fallbackStatus: number): MappedAuthError {
  if (isRecord(payload)) {
    const code = typeof payload.code === "string" ? payload.code : undefined;
    if (code && AUTH_ERROR_MESSAGES[code]) {
      return AUTH_ERROR_MESSAGES[code];
    }
    if (code?.startsWith("YOU_ARE_NOT_ALLOWED")) {
      return { status: 403, message: "You don't have permission to do that." };
    }
    const message =
      typeof payload.message === "string" && payload.message
        ? payload.message
        : FALLBACK_ERROR_MESSAGE;
    return { status: fallbackStatus, message };
  }
  if (typeof payload === "string" && payload) {
    return { status: fallbackStatus, message: payload };
  }
  return { status: fallbackStatus, message: FALLBACK_ERROR_MESSAGE };
}

function forwardCookies(res: ExpressResponse, upstream: globalThis.Response): void {
  const cookies = upstream.headers.getSetCookie?.() ?? [];
  for (const cookie of cookies) {
    res.append("Set-Cookie", cookie);
  }
}

async function readBody(response: globalThis.Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function proxyAuthResponse(
  res: ExpressResponse,
  upstream: globalThis.Response,
): Promise<unknown> {
  forwardCookies(res, upstream);
  const body = await readBody(upstream);
  if (upstream.ok) {
    return body;
  }
  const mapped = sanitizeAuthError(body, upstream.status);
  res.status(mapped.status);
  return { message: mapped.message };
}
