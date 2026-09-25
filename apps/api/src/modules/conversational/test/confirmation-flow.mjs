import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createDb, eq, generateId } = require("@nomidat/db");
const { user, organization, expense, message, product, order } = require("@nomidat/db/schema");
const {
  ConversationalService,
} = require("../../../../dist/modules/conversational/conversational.service.js");
const { ActionsService } = require("../../../../dist/modules/conversational/actions.service.js");
const {
  BusinessAuthService,
} = require("../../../../dist/modules/business/business-auth.service.js");
const { SalesService } = require("../../../../dist/modules/sales/sales.service.js");
const { SalesQueriesService } = require("../../../../dist/modules/sales/sales-queries.service.js");
const { InventoryService } = require("../../../../dist/modules/inventory/inventory.service.js");
const {
  PictureActionsService,
} = require("../../../../dist/modules/conversational/picture-actions.service.js");
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test"))
  throw new Error("Use TEST_DATABASE_URL with a disposable database ending in _test.");
const db = createDb(databaseUrl);
const organizationId = generateId();
const userId = generateId();
try {
  await db.insert(organization).values({
    id: organizationId,
    name: "Confirmation test",
    slug: `confirm-${organizationId}`,
    createdAt: new Date(),
  });
  await db
    .insert(user)
    .values({ id: userId, name: "Confirmation test", email: `${userId}@example.test` });
  const auth = new BusinessAuthService(null, db, {});
  const ai = {
    understand: async () => ({
      intent: "record_expense",
      amountNaira: 500,
      description: "Delivery",
    }),
  };
  const chat = new ConversationalService(
    db,
    ai,
    new ActionsService(
      db,
      new SalesService(db, new SalesQueriesService(db)),
      null,
      new PictureActionsService(
        new InventoryService(db),
        new SalesService(db, new SalesQueriesService(db)),
      ),
    ),
    auth,
  );
  const actor = { organizationId, userId, role: "owner" };
  const pending = await chat.createMessage(actor, "Record a delivery expense of 500 naira");
  assert.equal(pending.toolName, "pending_confirmation");
  assert.equal(
    (await db.select().from(expense).where(eq(expense.organizationId, organizationId))).length,
    0,
  );
  const results = await Promise.allSettled([
    chat.updateConfirmation(actor, pending.id, true),
    chat.updateConfirmation(actor, pending.id, true),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(
    (await db.select().from(expense).where(eq(expense.organizationId, organizationId))).length,
    1,
  );
  await assert.rejects(
    chat.createMessage({ ...actor, role: "staff" }, "Record expense"),
    /Only an owner/,
  );
  const cancelled = await chat.createMessage(actor, "Another expense");
  await chat.updateConfirmation(actor, cancelled.id, false);
  await assert.rejects(chat.updateConfirmation(actor, cancelled.id, true), /no longer awaiting/);
  const expired = await chat.createMessage(actor, "An old expense");
  await db
    .update(message)
    .set({ createdAt: new Date(Date.now() - 700000) })
    .where(eq(message.id, expired.id));
  await assert.rejects(chat.updateConfirmation(actor, expired.id, true), /expired/);
  const privateAction = await chat.createMessage(actor, "Private expense");
  await assert.rejects(
    chat.updateConfirmation(actor, privateAction.id, true, generateId()),
    /no longer awaiting/,
  );
  assert.equal(
    (await db.select().from(expense).where(eq(expense.organizationId, organizationId))).length,
    1,
  );
  const photo = await chat.createMessage(actor, "Extracted receipt: delivery NGN 750", undefined, {
    intent: "record_expense",
    amountNaira: 750,
    description: "Photo receipt",
    paymentMethod: "transfer",
  });
  assert.equal(photo.toolName, "pending_confirmation");
  assert.match(photo.content, /transfer/);
  assert.equal(
    (await db.select().from(expense).where(eq(expense.organizationId, organizationId))).length,
    1,
  );
  const photoConfirmations = await Promise.allSettled([
    chat.updateConfirmation(actor, photo.id, true),
    chat.updateConfirmation(actor, photo.id, true),
  ]);
  assert.equal(photoConfirmations.filter((result) => result.status === "fulfilled").length, 1);
  const photoExpenses = await db
    .select()
    .from(expense)
    .where(eq(expense.organizationId, organizationId));
  assert.equal(photoExpenses.length, 2);
  assert.ok(
    photoExpenses.some((row) => row.amountKobo === 75000 && row.paymentMethod === "transfer"),
  );
  const stockPhoto = await chat.createMessage(actor, "Product photo", undefined, {
    intent: "create_product",
    productName: "Photo product",
    stockQuantity: 2,
    unitPriceNaira: 500,
    unit: "bags",
  });
  assert.equal(
    (await db.select().from(product).where(eq(product.organizationId, organizationId))).length,
    0,
  );
  await chat.updateConfirmation(actor, stockPhoto.id, true);
  const [createdProduct] = await db
    .select()
    .from(product)
    .where(eq(product.organizationId, organizationId));
  assert.equal(createdProduct.stockQuantity, 2);
  assert.equal(createdProduct.priceKobo, 50000);
  const salePhoto = await chat.createMessage(actor, "Sale photo", undefined, {
    intent: "record_sale",
    items: [
      { description: "First item", quantity: 2, unitPriceNaira: 100 },
      { description: "Second item", quantity: 1, unitPriceNaira: 300 },
    ],
    paid: false,
  });
  assert.match(salePhoto.content, /stock is not deducted/);
  assert.equal(
    (await db.select().from(order).where(eq(order.organizationId, organizationId))).length,
    0,
  );
  await chat.updateConfirmation(actor, salePhoto.id, true);
  const [createdSale] = await db
    .select()
    .from(order)
    .where(eq(order.organizationId, organizationId));
  assert.equal(createdSale.totalKobo, 50000);
  console.log(
    "PASS: no financial write before confirmation; concurrent confirmation executes once; staff denied; cancellation, expiry and cross-conversation access denied.",
  );
} finally {
  await db.delete(organization).where(eq(organization.id, organizationId));
  await db.delete(user).where(eq(user.id, userId));
  await db.close();
}
