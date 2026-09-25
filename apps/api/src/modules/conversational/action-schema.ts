import { z } from "zod";

const money = z.number().finite().nonnegative().max(20_000_000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(value + "T12:00:00Z")) &&
      new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value,
    "Invalid date",
  );
export const parsedActionSchema = z
  .object({
    intent: z.enum([
      "create_product",
      "create_contact",
      "record_sale",
      "record_expense",
      "check_balance",
      "check_inventory",
      "summary",
      "unknown",
      "get_order_count",
      "list_low_stock",
      "get_daily_summary",
      "create_payment_link",
      "create_invoice",
      "send_invoice",
      "list_invoices",
      "get_expense_summary",
      "convert_lead_to_customer",
      "add_note",
      "get_client_folder",
    ]),
    customerName: z.string().min(1).max(160).optional(),
    customerPhone: z.string().min(1).max(40).optional(),
    productName: z.string().min(1).max(160).optional(),
    stockQuantity: z.number().int().min(0).max(100000).optional(),
    unitPriceNaira: money.optional(),
    unit: z.string().min(1).max(40).optional(),
    paymentMethod: z.enum(["cash", "transfer", "card"]).optional(),
    quantity: z.number().int().positive().max(100000).optional(),
    amountNaira: money.positive().optional(),
    paid: z.boolean().optional(),
    description: z.string().min(1).max(4000).optional(),
    category: z.string().min(1).max(100).optional(),
    date: date.optional(),
    contactId: z.string().uuid().optional(),
    invoiceId: z.string().uuid().optional(),
    orderId: z.string().uuid().optional(),
    email: z.string().email().optional(),
    discountNaira: money.optional(),
    taxNaira: money.optional(),
    items: z
      .array(
        z
          .object({
            description: z.string().min(1).max(300),
            productId: z.string().uuid().optional(),
            quantity: z.number().int().positive().max(100000),
            unitPriceNaira: money,
          })
          .strict(),
      )
      .min(1)
      .max(50)
      .optional(),
  })
  .strict();

export const writeActions = new Set([
  "create_product",
  "create_contact",
  "record_sale",
  "record_expense",
  "create_payment_link",
  "create_invoice",
  "send_invoice",
  "convert_lead_to_customer",
  "add_note",
]);
