import { createTestClient } from "./api-client.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createDb, eq } = require("@nomidat/db");
const { user } = require("@nomidat/db/schema");
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test"))
  throw new Error("Use a disposable TEST_DATABASE_URL ending in _test.");
import assert from "node:assert/strict";
const base = process.env.TEST_API_URL;
if (!base) throw new Error("Set TEST_API_URL to an isolated API with email delivery disabled.");
const stamp = Date.now();
const { session, request } = createTestClient(base, process.env.TEST_WEB_ORIGIN);
const credentials = {
  name: "Staff test owner",
  email: `staff-owner-${stamp}@example.test`,
  password: "StaffFlowTest2026!",
};
await request("/auth/sign-up/email", "POST", credentials, 201);
const business = await request(
  "/organizations",
  "POST",
  { name: "Staff test business", slug: `staff-test-${stamp}` },
  201,
);
const ownerCookie = session.cookie;
const path = `/organizations/${business.id}`;
const inviteEmail = `staff-invite-${stamp}@example.test`;
const invitation = await request(
  path + "/invitations",
  "POST",
  { email: inviteEmail, role: "staff" },
  201,
);
assert.ok((await request(path + "/invitations")).some((row) => row.id === invitation.id));
session.cookie = "";
await request(
  "/auth/sign-up/email",
  "POST",
  { ...credentials, email: `staff-wrong-${stamp}@example.test` },
  201,
);
const wrongResponse = await fetch(base + `/invitations/${invitation.id}/accept`, {
  method: "POST",
  headers: {
    Cookie: session.cookie,
    "Content-Type": "application/json",
    Origin: "http://localhost:3017",
  },
  body: "{}",
});
assert.ok([400, 403].includes(wrongResponse.status));
session.cookie = "";
await request(
  "/auth/sign-up/email",
  "POST",
  { ...credentials, name: "Invited staff", email: inviteEmail },
  201,
);
const staffCookie = session.cookie;
assert.equal((await request("/auth/session")).user.email, inviteEmail);
await request(`/invitations/${invitation.id}`, "GET", undefined, 403);
// Model an already verified identity in the isolated database only.
const db = createDb(databaseUrl);
try {
  await db.update(user).set({ emailVerified: true }).where(eq(user.email, inviteEmail));
} finally {
  await db.close();
}

assert.equal((await request(`/invitations/${invitation.id}`)).organizationName, business.name);
await request(`/invitations/${invitation.id}/accept`, "POST", {}, 201);
assert.equal((await request(path + "/access")).role, "staff");
await request(path + "/contacts", "POST", { name: "Denied", kind: "customer" }, 403);
const list = await request(path + "/members?limit=20&offset=0");
assert.equal(list.total, 2);
const staff = list.members.find((row) => row.user.email === inviteEmail);
assert.ok(staff);
await request(path + `/members/${staff.id}`, "PATCH", { role: "admin" }, 403);
session.cookie = ownerCookie;
await request(path + `/members/${staff.id}`, "PATCH", { role: "manager" });
session.cookie = staffCookie;
assert.equal((await request(path + "/access")).role, "manager");
await request(path + "/contacts", "POST", { name: "Allowed", kind: "customer" }, 201);
session.cookie = ownerCookie;
await request(path + `/members/${staff.id}`, "DELETE");
session.cookie = staffCookie;
await request(path + "/access", "GET", undefined, 403);
session.cookie = ownerCookie;
const cancelled = await request(
  path + "/invitations",
  "POST",
  { email: `cancel-${stamp}@example.test`, role: "staff" },
  201,
);
await request(`/invitations/${cancelled.id}/cancel`, "POST", {}, 201);
assert.equal(
  (await request(path + "/invitations")).find((row) => row.id === cancelled.id).status,
  "canceled",
);
console.log(
  "PASS: invitation acceptance, wrong-email rejection, member list, staff write denial, role changes, removal and cancellation.",
);
