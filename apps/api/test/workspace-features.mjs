import { createTestClient } from "./api-client.mjs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createDb, eq } = require("@nomidat/db");
const { user } = require("@nomidat/db/schema");
const base = process.env.TEST_API_URL;
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!base || !databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test"))
  throw new Error("Use an isolated API, email disabled, and a database ending in _test.");
const { session, request } = createTestClient(base, process.env.TEST_WEB_ORIGIN);
const stamp = Date.now();
const credentials = {
  name: "UI feature check",
  email: `ui-features-${stamp}@example.test`,
  password: "UIFeatureCheck2026!",
};
await request("/auth/sign-up/email", "POST", credentials, 201);
const ownerCookie = session.cookie;
const org = await request(
  "/organizations",
  "POST",
  { name: "UI feature checks", slug: `ui-features-${stamp}` },
  201,
);
const path = `/organizations/${org.id}`;
await request(path, "PATCH", {
  data: {
    name: "Updated shop",
    metadata: {
      businessDetails: {
        address: "10 Test Street",
        phone: "+2348000000000",
        ownerName: "Test Owner",
      },
    },
  },
});
const profile = await request(path);
assert.equal(profile.name, "Updated shop");
const metadata =
  typeof profile.metadata === "string" ? JSON.parse(profile.metadata) : profile.metadata;
assert.equal(metadata.businessDetails.address, "10 Test Street");
const category = await request(
  path + "/expense-categories",
  "POST",
  { name: "Repairs", description: "Test category" },
  201,
);
const expense = await request(
  path + "/expenses",
  "POST",
  { description: "Original", amountKobo: 10000 },
  201,
);
await request(path + `/expenses/${expense.id}`, "PATCH", {
  description: "Changed",
  amountKobo: 20000,
  categoryId: category.id,
  spentAt: "2026-09-24T10:00:00.000Z",
  paymentMethod: "transfer",
  receiptUrl: "https://example.test/receipt",
});
const updated = await request(path + `/expenses/${expense.id}`);
assert.equal(updated.categoryId, category.id);
assert.equal(updated.paymentMethod, "transfer");
assert.equal(updated.spentAt, "2026-09-24T10:00:00.000Z");
await request(path + `/expenses/${expense.id}`, "DELETE");
await request(path + `/expenses/${expense.id}`, "GET", undefined, 404);
const sale = await request(
  path + "/sales",
  "POST",
  {
    items: [{ productName: "Test item", quantity: 2, unitPriceKobo: 10000 }],
    paymentAmountKobo: 5000,
    paymentMethod: "cash",
  },
  201,
);
const receipt = await request(path + `/sales/${sale.id}/receipt`);
assert.equal(receipt.items.length, 1);
assert.equal(receipt.paidKobo, 5000);
assert.equal(receipt.balanceKobo, 15000);
assert.equal(receipt.payments.length, 1);
assert.ok(Array.isArray(await request("/auth/sessions")));
const invitedEmail = `ui-inbox-${stamp}@example.test`;
const invitation = await request(
  path + "/invitations",
  "POST",
  { email: invitedEmail, role: "staff" },
  201,
);
session.cookie = "";
const invited = await request(
  "/auth/sign-up/email",
  "POST",
  { ...credentials, email: invitedEmail },
  201,
);
const invitedCookie = session.cookie;
const db = createDb(databaseUrl);
try {
  await db.update(user).set({ emailVerified: true }).where(eq(user.id, invited.user.id));
} finally {
  await db.close();
}
const inbox = await request("/invitations");
assert.ok(inbox.some((row) => row.id === invitation.id));
await request(`/invitations/${invitation.id}/reject`, "POST", {}, 201);
session.cookie = ownerCookie;
await request(path + "/members", "POST", { userId: invited.user.id, role: "staff" }, 201);
session.cookie = invitedCookie;
await request(path + "/leave", "POST", {}, 201);
await request(path + "/access", "GET", undefined, 403);
session.cookie = ownerCookie;
await request(path, "DELETE");
await request(path + "/access", "GET", undefined, 403);
await request("/auth/sign-out", "POST", {}, 201);
assert.equal(Boolean(await request("/auth/session")), false);
console.log(
  "PASS: profile update, category creation, full expense edits/deletion, receipts/payment history, sessions, invitation inbox/rejection, leave, business deletion and sign-out.",
);
