import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

const base = process.env.TEST_API_URL;
if (!base)
  throw new Error("Set TEST_API_URL to an isolated running API; this check creates test records.");
let cookie = "";
async function request(path, method = "GET", body, expected = 200) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: process.env.TEST_WEB_ORIGIN ?? "http://localhost:3017",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) cookie = cookies.map((value) => value.split(";")[0]).join("; ");
  const text = await response.text();
  assert.equal(response.status, expected, `${method} ${path}: ${text}`);
  return text ? JSON.parse(text) : undefined;
}
const testLogo =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAA8CAIAAAAiz+n/AAAApUlEQVR4nO3QAQnDUABEsSoa1MA0TMes10RlvPsQiIJcz/8+zuf7O86Vr4nela+J3iVatOhcviZ6l2jRonP5muhdokWLzuVroneJFi06l6+J3iVatOhcviZ6l2jRonP5muhdokWLzuVroneJFi06l6+J3iVatOhcviZ6l2jRonP5muhdokWLzuVroneJFi06l6+J3iVatOhcviZ6l2jRonP5muhdLxOswfIG/WbJAAAAAElFTkSuQmCC";
const stamp = Date.now();
const email = `nomidat-check-${stamp}@example.test`;
const password = "LocalVerification2026!";
await request("/auth/sign-up/email", "POST", { name: "Verification Owner", email, password }, 201);
const first = await request(
  "/organizations",
  "POST",
  {
    name: "Verification Trading",
    logo: testLogo,
    slug: `verify-${stamp}`,
    businessDetails: {
      ownerName: "Verification Owner",
      phone: "+234 800 000 0000",
      address: "12 Test Street, Lagos",
      shopNumber: "B12",
      email: "shop@example.test",
      registrationNumber: "RC TEST123",
    },
  },
  201,
);
const second = await request(
  "/organizations",
  "POST",
  { name: "Other Test Business", slug: `other-${stamp}` },
  201,
);
const a = `/organizations/${first.id}`;
const b = `/organizations/${second.id}`;
// Multipart validation must reject bad files before contacting an AI provider.
const badPicture = new FormData();
badPicture.append("purpose", "inventory");
badPicture.append("picture", new Blob(["not an image"], { type: "image/png" }), "invalid.png");
const pictureResponse = await fetch(base + a + "/picture-import", {
  method: "POST",
  headers: { Cookie: cookie, Origin: "http://localhost:3017" },
  body: badPicture,
});
assert.equal(pictureResponse.status, 400, await pictureResponse.text());
badPicture.set("purpose", "expenses");
const expensePictureResponse = await fetch(base + a + "/picture-import", {
  method: "POST",
  headers: { Cookie: cookie, Origin: "http://localhost:3017" },
  body: badPicture,
});
assert.equal(expensePictureResponse.status, 400);
assert.match((await expensePictureResponse.json()).message, /not a supported picture/);
badPicture.set("purpose", "invoices");
const invoicePictureResponse = await fetch(base + a + "/picture-import", {
  method: "POST",
  headers: { Cookie: cookie, Origin: "http://localhost:3017" },
  body: badPicture,
});
assert.equal(invoicePictureResponse.status, 400);
assert.match((await invoicePictureResponse.json()).message, /not a supported picture/);
const anonymousPicture = await fetch(base + a + "/picture-import", {
  method: "POST",
  body: badPicture,
});
assert.equal(anonymousPicture.status, 401, await anonymousPicture.text());
const person = await request(
  a + "/contacts",
  "POST",
  { name: "Chinedu Test", kind: "lead", email: "chinedu@example.test" },
  201,
);
await request(a + `/contacts/${person.id}/convert`, "POST", {}, 201);
await request(
  a + `/contacts/${person.id}/notes`,
  "POST",
  { body: "Prefers Friday delivery." },
  201,
);
await request(b + `/contacts/${person.id}`, "GET", undefined, 404);
const product = await request(
  a + "/products",
  "POST",
  { name: "Cement", priceKobo: 850000, stockQuantity: 20, lowStockThreshold: 5, unit: "bags" },
  201,
);
const sale = await request(
  a + "/sales",
  "POST",
  {
    customerId: person.id,
    items: [{ productId: product.id, quantity: 5, unitPriceKobo: 850000 }],
    paymentAmountKobo: 1000000,
    paymentMethod: "cash",
  },
  201,
);
assert.equal(sale.balanceKobo, 3250000);
assert.equal((await request(a + `/products/${product.id}`)).stockQuantity, 15);
await request(
  b + "/sales",
  "POST",
  { items: [{ productId: product.id, quantity: 1, unitPriceKobo: 850000 }] },
  404,
);
await request(a + `/products/${product.id}/stock-adjustments`, "POST", { quantity: -100 }, 409);
await request(
  a + "/sales",
  "POST",
  {
    items: [{ productId: product.id, quantity: 2, unitPriceKobo: 2147483647 }],
  },
  400,
);
await request(a + `/products/${product.id}`, "PATCH", { isActive: false });
await request(
  a + "/sales",
  "POST",
  {
    items: [{ productId: product.id, quantity: 1, unitPriceKobo: 850000 }],
  },
  409,
);
assert.equal(
  (await request(a + `/products/${product.id}`, "PATCH", { isActive: true })).isActive,
  true,
);

const category = await request(
  a + "/expense-categories",
  "POST",
  { name: "Test-only delivery" },
  201,
);
assert.ok(!(await request(b + "/expense-categories")).some((row) => row.id === category.id));
await request(b + "/expenses", "POST", { amountKobo: 50000, categoryId: category.id }, 404);
await request(
  a + "/expenses",
  "POST",
  { amountKobo: 50000, description: "Delivery", categoryId: category.id },
  201,
);
const invoice = await request(
  a + "/invoices",
  "POST",
  {
    customerId: person.id,
    items: [{ description: "Cement", quantity: 5, unitPriceKobo: 850000 }],
    taxKobo: 5000,
    discountKobo: 10000,
  },
  201,
);
assert.equal(invoice.totalKobo, 4245000);
assert.equal(invoice.businessLogo, testLogo);
assert.equal(invoice.businessDetails.address, "12 Test Street, Lagos");
assert.equal(invoice.businessDetails.phone, "+234 800 000 0000");
assert.equal(invoice.businessDetails.shopNumber, "B12");
assert.equal(invoice.businessDetails.email, "shop@example.test");
assert.equal(invoice.businessDetails.registrationNumber, "RC TEST123");
assert.equal(invoice.businessDetails.ownerName, undefined);
const reloadedInvoice = await request(a + `/invoices/${invoice.id}`);
assert.deepEqual(reloadedInvoice.businessDetails, invoice.businessDetails);
await request(b + `/invoices/${invoice.id}`, "GET", undefined, 404);
const folder = await request(a + `/contacts/${person.id}`);
assert.equal(folder.balanceKobo, 3250000);
assert.equal(folder.notes[0].body, "Prefers Friday delivery.");
assert.equal(folder.contact.kind, "customer");
assert.equal((await request(a + "/summary")).outstandingCreditKobo, 3250000);
const reportRange = new URLSearchParams({
  from: new Date(Date.now() - 30 * 86400000).toISOString(),
  to: new Date().toISOString(),
});
const report = await request(a + "/reports/summary?" + reportRange);
assert.equal(report.salesKobo, 4250000);
assert.equal(report.collectedKobo, 1000000);
assert.equal(report.expensesKobo, 50000);
assert.equal(report.netCashflowKobo, 950000);

const pdf = await fetch(base + a + `/invoices/${invoice.id}/pdf`, { headers: { Cookie: cookie } });
assert.equal(pdf.status, 200);
const bytes = Buffer.from(await pdf.arrayBuffer());
assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
assert.match(bytes.toString("latin1"), /\/Subtype \/Image/);
await writeFile("/tmp/nomidat-invoice-verification.pdf", bytes);
await request(
  a + "/contacts",
  "POST",
  { name: "Invalid", kind: "customer", organizationId: second.id },
  400,
);
const creditCheck = await request(
  a + "/sales",
  "POST",
  {
    items: [{ productName: "Payment balance check", quantity: 1, unitPriceKobo: 40000 }],
    paymentAmountKobo: 30000,
    paymentMethod: "cash",
  },
  201,
);
const creditPath = a + `/sales/${creditCheck.id}`;
const beforePayment = await request(creditPath);
assert.equal(beforePayment.totalKobo, 40000);
assert.equal(beforePayment.paidKobo, 30000);
assert.equal(beforePayment.balanceKobo, 10000);
const listedCredit = (await request(a + "/sales?limit=50")).find(
  (row) => row.id === creditCheck.id,
);
assert.equal(listedCredit.paidKobo, 30000);
assert.equal(listedCredit.balanceKobo, 10000);
assert.match(listedCredit.saleReference, /^SALE-[A-F0-9]{12}$/);
assert.deepEqual(listedCredit.saleItems, [{ productName: "Payment balance check", quantity: 1 }]);
assert.equal(
  (await request(b + "/sales?limit=50")).some((row) => row.id === creditCheck.id),
  false,
);
assert.deepEqual(await request(a + "/sales?limit=50&offset=9999"), []);

await request(creditPath + "/payments", "POST", { amountKobo: 20000, method: "cash" }, 400);
assert.equal((await request(creditPath)).paidKobo, 30000);
await request(creditPath + "/payments", "POST", { amountKobo: 10000, method: "cash" }, 201);
const settled = await request(creditPath);
assert.equal(settled.paidKobo, 40000);
assert.equal(settled.balanceKobo, 0);
const listedSettled = (await request(a + "/sales?limit=50")).find(
  (row) => row.id === creditCheck.id,
);
assert.equal(listedSettled.paidKobo, 40000);
assert.equal(listedSettled.balanceKobo, 0);
assert.equal(listedSettled.saleReference, listedCredit.saleReference);
await request(creditPath + "/payments", "POST", { amountKobo: 1, method: "cash" }, 400);
const ownerCookie = cookie;
cookie = "";
const staff = await request(
  "/auth/sign-up/email",
  "POST",
  { name: "Staff verification", email: `staff-${stamp}@example.test`, password },
  201,
);
const staffCookie = cookie;
cookie = "";
await request(a + "/members", "POST", { userId: staff.user.id, role: "owner" }, 401);
cookie = ownerCookie;
await request(a + "/members", "POST", { userId: staff.user.id, role: "staff" }, 201);
cookie = staffCookie;
await request(a + "/contacts");
await request(a + "/contacts", "POST", { name: "Forbidden", kind: "customer" }, 403);
await request(a + "/products", "POST", { name: "Forbidden", priceKobo: 100 }, 403);
await request(a + "/members", "POST", { userId: staff.user.id, role: ["owner"] }, 403);
cookie = ownerCookie;
const savedCookie = cookie;
cookie = "";
await request(a + "/contacts", "GET", undefined, 401);
cookie = savedCookie;
await writeFile(
  "/tmp/nomidat-local-verification.json",
  JSON.stringify({
    email,
    password,
    organizationId: first.id,
    otherOrganizationId: second.id,
    invoiceId: invoice.id,
  }),
);
console.log(
  "PASS: registration, organizations, contacts, conversion, notes, stock, partial payments, invoice totals, PDF, tenant isolation, mass-assignment rejection and unauthenticated access.",
);
