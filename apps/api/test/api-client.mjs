import assert from "node:assert/strict";

/** A test session whose cookie can be saved/restored when switching actors. */
export function createTestClient(base, origin = "http://localhost:3017") {
  const session = { cookie: "" };
  async function request(path, method = "GET", body, expected = 200) {
    const response = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: session.cookie, Origin: origin },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) session.cookie = cookies.map((value) => value.split(";")[0]).join("; ");
    const text = await response.text();
    assert.equal(response.status, expected, `${method} ${path}: ${text}`);
    return text ? JSON.parse(text) : undefined;
  }
  return { session, request };
}
