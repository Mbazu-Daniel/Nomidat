const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:3001";

export async function createApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Request failed (${response.status})`;
    try {
      const payload = JSON.parse(text);
      if (Array.isArray(payload.message)) message = payload.message.join(". ");
      else if (typeof payload.message === "string") message = payload.message;
    } catch {
      // Non-JSON responses retain their original message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (response.headers.get("content-type")?.includes("application/pdf"))
    return (await response.blob()) as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
