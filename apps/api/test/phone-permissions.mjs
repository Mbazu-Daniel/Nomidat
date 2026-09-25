import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createDb, eq } = require("@nomidat/db");
const { phoneInvitation, verification } = require("@nomidat/db/schema");
const { createBetterAuth } = require("../dist/common/better-auth/create-better-auth.js");
const base = process.env.TEST_API_URL;
const databaseUrl = process.env.TEST_DATABASE_URL;
const secret = process.env.TEST_AUTH_SECRET;
if (!base || !databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test") || !secret)
  throw new Error("Use an isolated API, a _test database, and TEST_AUTH_SECRET.");
const db = createDb(databaseUrl);
let capturedCode;
const auth = createBetterAuth({
  db,
  secret,
  baseURL: new URL(base).origin,
  webOrigin: "http://localhost:3017",
  sendPhoneOTP: async ({ code }) => {
    capturedCode = code;
  },
});
let cookie = "";
async function request(path, method = "GET", body, expected = 200) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: "http://localhost:3017",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) cookie = cookies.map((v) => v.split(";")[0]).join("; ");
  const text = await response.text();
  assert.equal(response.status, expected, method + " " + path + ": " + text);
  return text ? JSON.parse(text) : null;
}
async function phoneRequest(path, body, expected = 200) {
  const response = await auth.handler(
    new Request(new URL("/api/v1/auth/phone-number/" + path, base), {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3017" },
      body: JSON.stringify(body),
    }),
  );
  const text = await response.text();
  assert.equal(response.status, expected, path + ": " + text);
  const cookies = response.headers.getSetCookie();
  if (cookies.length) cookie = cookies.map((v) => v.split(";")[0]).join("; ");
  return text ? JSON.parse(text) : null;
}
const stamp = Date.now();
const phoneNumber = "+234" + String(stamp).slice(-10);
try {
  await request(
    "/auth/sign-up/email",
    "POST",
    {
      name: "Phone test owner",
      email: `phone-owner-${stamp}@example.test`,
      password: "PhoneTest2026!Secure",
    },
    201,
  );
  const org = await request(
    "/organizations",
    "POST",
    { name: "Phone test", slug: "phone-" + stamp },
    201,
  );
  const ownerCookie = cookie;
  const path = "/organizations/" + org.id;
  const invite = await request(
    path + "/phone-invitations",
    "POST",
    { phoneNumber, roles: ["staff", "expenses_writer"] },
    201,
  );
  await request(path + "/phone-invitations", "POST", { phoneNumber, roles: ["staff"] }, 400);
  await request(
    path + "/phone-invitations",
    "POST",
    { phoneNumber: "+2348000000000", roles: ["owner"] },
    400,
  );
  await request("/phone-invitations/" + invite.id + "/accept", "POST", {}, 403);
  // Exercise the real OTP plugin with an in-process delivery fake, never sending real SMS.
  await phoneRequest("send-otp", { phoneNumber });
  assert.match(capturedCode, /^\d{6}$/);
  const wrongCode = capturedCode === "000000" ? "000001" : "000000";
  await phoneRequest("verify", { phoneNumber, code: wrongCode }, 400);
  await phoneRequest("verify", { phoneNumber, code: capturedCode });
  const staffCookie = cookie;
  await phoneRequest("verify", { phoneNumber, code: capturedCode }, 400);
  const inbox = await request("/phone-invitations");
  assert.ok(inbox.some((row) => row.id === invite.id));
  await request("/phone-invitations/" + invite.id + "/accept", "POST", {}, 201);
  await request("/phone-invitations/" + invite.id + "/accept", "POST", {}, 400);
  assert.equal((await request(path + "/access")).role, "staff,expenses_writer");
  await request(
    path + "/expenses",
    "POST",
    { description: "Allowed expense", amountKobo: 5000 },
    201,
  );
  await request(path + "/products", "POST", { name: "Denied", priceKobo: 100 }, 403);
  await request(path + "/contacts", "POST", { name: "Denied", kind: "customer" }, 403);
  await request(
    path + "/phone-invitations",
    "POST",
    { phoneNumber: "+2348000000001", roles: ["staff"] },
    403,
  );
  await request(
    path + "/business-profile/payment-key",
    "PUT",
    { secretKey: "sk_test_fake123" },
    403,
  );
  await request(path + "/payments/paystack/fake/verify", "GET", undefined, 403);
  // Revocation is checked on each request, not cached in the login session.
  cookie = ownerCookie;
  const people = await request(path + "/members");
  const staff = people.members.find((row) => row.role === "staff,expenses_writer");
  assert.ok(staff);
  await request(path + "/members/" + staff.id, "PATCH", { role: ["staff", "inventory_writer"] });
  cookie = staffCookie;
  await request(path + "/expenses", "POST", { description: "Denied now", amountKobo: 5000 }, 403);
  const product = await request(
    path + "/products",
    "POST",
    {
      name: "Allowed stock",
      priceKobo: 500,
      costKobo: 200,
      sku: "SKU-" + stamp,
      description: "Test",
    },
    201,
  );
  assert.equal(product.costKobo, 200);
  // Another phone cannot claim an invitation; cancelled/expired invitations cannot be used.
  cookie = ownerCookie;
  const wrongInvite = await request(
    path + "/phone-invitations",
    "POST",
    { phoneNumber: "+2348000000002", roles: ["staff"] },
    201,
  );
  cookie = staffCookie;
  await request("/phone-invitations/" + wrongInvite.id + "/accept", "POST", {}, 403);
  cookie = ownerCookie;
  const cancelled = await request(
    path + "/phone-invitations",
    "POST",
    { phoneNumber, roles: ["manager"] },
    201,
  );
  await request(path + "/phone-invitations/" + cancelled.id + "/cancel", "POST", {}, 201);
  cookie = staffCookie;
  await request("/phone-invitations/" + cancelled.id + "/accept", "POST", {}, 400);
  cookie = ownerCookie;
  const expired = await request(
    path + "/phone-invitations",
    "POST",
    { phoneNumber, roles: ["manager"] },
    201,
  );
  await db
    .update(phoneInvitation)
    .set({ expiresAt: new Date(0) })
    .where(eq(phoneInvitation.id, expired.id));
  cookie = staffCookie;
  await request("/phone-invitations/" + expired.id + "/accept", "POST", {}, 400);
  // A phone invite never overwrites permissions of an existing member.
  cookie = ownerCookie;
  const again = await request(
    path + "/phone-invitations",
    "POST",
    { phoneNumber, roles: ["manager"] },
    201,
  );
  cookie = staffCookie;
  await request("/phone-invitations/" + again.id + "/accept", "POST", {}, 201);
  assert.equal((await request(path + "/access")).role, "staff,inventory_writer");
  cookie = ownerCookie;
  await request(path + "/members/" + staff.id, "DELETE");
  cookie = staffCookie;
  await request(path + "/products", "GET", undefined, 403);
  cookie = ownerCookie;
  await request(path, "DELETE");
  await phoneRequest("send-otp", { phoneNumber });
  await db
    .update(verification)
    .set({ expiresAt: new Date(0) })
    .where(eq(verification.identifier, phoneNumber));
  await phoneRequest("verify", { phoneNumber, code: capturedCode }, 400);
  await phoneRequest("send-otp", { phoneNumber });
  const invalid = capturedCode === "000000" ? "000001" : "000000";
  for (let attempt = 0; attempt < 3; attempt++)
    await phoneRequest("verify", { phoneNumber, code: invalid }, 400);
  await phoneRequest("verify", { phoneNumber, code: capturedCode }, 403);
  console.log(
    "Phone OTP, invitation lifecycle, identity checks, custom permissions and revocation passed.",
  );
} finally {
  await db.close();
}
