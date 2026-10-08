import axios, { type Method } from "axios";
import { createAuthClient } from "better-auth/react";
import { phoneNumberClient } from "better-auth/client/plugins";
import { organizationClient } from "better-auth/client/plugins";

/**
 * The one auth client for the browser.
 *
 * The API serves Better Auth at `/api/v1/auth`, and this points the client at
 * exactly that. Calling auth endpoints by hand meant re-implementing cookie
 * handling, error shapes and refetch on every screen — and the phone plugin
 * needed a second attempt whenever Better Auth changed a route. One client means
 * the browser and the server can never disagree about the contract.
 *
 * `credentials: "include"` is required: sessions are httpOnly cookies, and the
 * client cannot read or set them itself.
 */
export const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";

/**
 * The Telegram bot whose Login Widget renders on the auth pages.
 *
 * Only the username reaches the browser; the token that signs the payload stays
 * on the API. Empty means the widget is not offered, and the button is hidden
 * rather than left to fail.
 */
export const TELEGRAM_BOT_USERNAME =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_TELEGRAM_BOT_USERNAME as string | undefined)) ||
  "";

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  basePath: "/api/v1/auth",
  fetchOptions: { credentials: "include" },
  plugins: [phoneNumberClient(), organizationClient()],
});

/**
 * Telegram sign-in is served by our own plugin, which is not part of Better
 * Auth's typed client. It is the one call that still has to be hand-written, and
 * it is isolated here so there is a single place to look when the plugin changes.
 */
export async function signInWithTelegram(init: string) {
  const { data } = await http.post<{ user?: { name?: string | null } | null }>(
    "/auth/sign-in/telegram-mini-app",
    init,
  );
  return data;
}

/**
 * Telegram Login Widget sign-in. The payload is signed by Telegram with the bot
 * token, and the API re-derives that signature — nothing here is trusted.
 */
export async function signInWithTelegramWidget(payload: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}) {
  const { data } = await http.post<{ user?: { name?: string | null } | null }>(
    "/auth/sign-in/telegram",
    payload,
  );
  return data;
}

/**
 * The one HTTP client for the browser.
 *
 * Axios rather than `fetch` because the offline queue has to tell a dead network
 * apart from a deliberate refusal, and it has to do that on requests that were
 * already queued. That distinction lives in this module's interceptors so no
 * caller re-implements it.
 */
export const http = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  // Sessions are httpOnly cookies, so every call has to present them.
  withCredentials: true,
  // A base-URL mismatch between the web app and the API is a configuration
  // fault, not a transient one. Retrying it only delays the real message.
  timeout: 20_000,
});

export class ApiError extends Error {
  constructor(
    message: string,
    /** Absent when the request never reached the server. */
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * True only when the request never got an answer from the server.
 *
 * A 4xx or 5xx is a real decision by the API and must surface — queueing a sale
 * the server actively refused would hide the refusal. A transport failure means
 * the sale is safely unsent, so the caller can queue it.
 *
 * `isNetworkFailure` reads the absent status rather than axios's own error
 * codes, so that shape is part of the contract.
 */
export function isNetworkFailure(reason: unknown): boolean {
  return reason instanceof ApiError ? reason.status === undefined : reason instanceof TypeError;
}

/**
 * Normalises anything axios can reject with into a single ApiError shape.
 *
 * Nest returns `{ message: string | string[] }`, and the array form is a
 * class-validator failure listing every bad field. Joining it keeps the UI's
 * one-line error slot usable.
 */
function toApiError(reason: unknown): unknown {
  if (reason instanceof ApiError) return reason;
  if (!axios.isAxiosError(reason)) return reason;

  // No response means the request never arrived: DNS, refused connection, CORS,
  // or a timeout. That is the case the offline queue is allowed to retry.
  if (!reason.response) {
    return new ApiError(
      reason.code === "ECONNABORTED"
        ? "The server took too long to respond."
        : "The server could not be reached.",
    );
  }

  const { status, data } = reason.response;
  let message = `Request failed (${status})`;
  if (typeof data === "string" && data) {
    message = data;
  } else if (data && typeof data === "object" && "message" in data) {
    const value = (data as { message?: unknown }).message;
    if (Array.isArray(value)) message = value.join(". ");
    else if (typeof value === "string" && value) message = value;
  }
  return new ApiError(message, status);
}

http.interceptors.response.use(
  (response) => response,
  (reason: unknown) => Promise.reject(toApiError(reason)),
);

/**
 * Issues a request and returns the parsed body.
 *
 * Accepts the same `RequestInit` the rest of the app was written against, so
 * callers do not all have to change shape at once — `body` becomes `data` and
 * everything else maps straight across.
 */
export async function createApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  // `headers` and `signal` are pulled out of the rest and passed under their
  // axios names: spreading either one carries a `HeadersInit` / `null` union
  // straight onto the axios config, which its types reject.
  const { body, headers: rawHeaders, signal, ...rest } = init ?? {};
  const isForm = body instanceof FormData;

  // `RequestInit.headers` may be a Headers instance, an array of pairs, or a
  // plain object, and axios wants a plain object. Reduced to strings here so
  // every existing caller keeps working without converting its own headers.
  const headers: Record<string, string> = {};
  const incoming = new Headers(rawHeaders);
  incoming.forEach((value, key) => {
    headers[key] = value;
  });
  // FormData sets its own multipart boundary, so no Content-Type is sent for it.
  if (!isForm && !incoming.has("content-type")) headers["Content-Type"] = "application/json";

  const response = await http.request<T>({
    url: path,
    method: (rest.method ?? "GET") as Method,
    data: isForm ? body : body === undefined ? undefined : JSON.parse(String(body)),
    headers,
    // RequestInit allows `null`; axios only accepts undefined, and dropping a
    // null is the same as "no cancellation was requested".
    signal: signal ?? undefined,
    ...rest,
  });

  if (response.status === 204) return undefined as T;
  // Invoices come back as a rendered PDF rather than JSON.
  const contentType = String(response.headers["content-type"] ?? "");
  if (contentType.includes("application/pdf")) return response.data as T;
  return response.data as T;
}
