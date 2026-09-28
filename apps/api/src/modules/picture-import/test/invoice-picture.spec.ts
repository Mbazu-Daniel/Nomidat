import { afterEach, describe, expect, it, vi } from "vitest";
import { validate } from "class-validator";
import { PictureImportService } from "../picture-import.service";
import { ExtractPictureDto } from "../dto/extract-picture.dto";
import type { ApiEnv } from "../../../common/config/env";

const env = { OPENAI_API_KEY: "test", OPENAI_MODEL: "test-vision" } as ApiEnv;
const file = {
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=",
    "base64",
  ),
  mimetype: "image/png",
};
const draft = {
  items: [{ name: "Cement", quantity: 2, unitPriceNaira: 10000, unit: "bags" }],
  invoice: {
    customerName: "Example buyer",
    dueDate: "2026-10-10",
    taxNaira: 1500,
    discountNaira: 1000,
    totalNaira: 20500,
    notes: "Reference INV-101",
  },
  warnings: [],
};
function respond(content: unknown) {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
      ),
    );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
afterEach(() => vi.unstubAllGlobals());

describe("invoice picture extraction", () => {
  it("returns invoice details and line items as a draft through a single read request", async () => {
    const fetch = respond(draft);
    await expect(new PictureImportService(env).extract("invoices", file)).resolves.toEqual(draft);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("leaves unknown financial facts and dates empty instead of defaulting them", async () => {
    const missing = {
      ...draft,
      invoice: {
        customerName: null,
        dueDate: null,
        taxNaira: null,
        discountNaira: null,
        totalNaira: null,
        notes: null,
      },
    };
    respond(missing);
    await expect(new PictureImportService(env).extract("invoices", file)).resolves.toEqual(missing);
  });
  it.each([
    { dueDate: "2026-02-30" },
    { dueDate: "net 30" },
    { taxNaira: -1 },
    { discountNaira: 20000001 },
    { totalNaira: -10 },
    { customerId: "invented-id" },
    { paid: true },
    { invoiceNumber: "replace-existing" },
  ])("rejects invalid invoice details or executable identity fields", async (patch) => {
    respond({ ...draft, invoice: { ...draft.invoice, ...patch } });
    await expect(new PictureImportService(env).extract("invoices", file)).rejects.toThrow(
      "couldn't read",
    );
  });
  it("rejects a sales-only response for invoice extraction", async () => {
    respond({ items: draft.items, warnings: [] });
    await expect(new PictureImportService(env).extract("invoices", file)).rejects.toThrow(
      "couldn't read",
    );
  });
  it("accepts invoices as an extraction purpose", async () => {
    expect(
      await validate(Object.assign(new ExtractPictureDto(), { purpose: "invoices" })),
    ).toHaveLength(0);
  });
});
