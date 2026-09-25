import { afterEach, describe, expect, it, vi } from "vitest";
import { validate } from "class-validator";
import { PictureImportService } from "../picture-import.service";
import { PictureImportController } from "../picture-import.controller";
import { ExtractPictureDto } from "../dto/extract-picture.dto";
import type { ApiEnv } from "../../../common/config/env";
import type { BusinessAuthService } from "../../business/business-auth.service";
import type { Request } from "express";

const env = { OPENAI_API_KEY: "test", OPENAI_MODEL: "test-vision" } as ApiEnv;
const file = {
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=",
    "base64",
  ),
  mimetype: "image/png",
};
const draft = {
  items: [{ name: "Cement", quantity: null, unitPriceNaira: 12500, unit: null }],
  warnings: ["Quantity is unclear"],
};
function provider(content: unknown) {
  return vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }),
      ),
    );
}
afterEach(() => vi.unstubAllGlobals());

describe("picture extraction boundary", () => {
  it("sends image bytes to the configured model and preserves missing facts in a draft", async () => {
    const fetch = provider(draft);
    vi.stubGlobal("fetch", fetch);
    await expect(new PictureImportService(env).extract("sales", file)).resolves.toEqual(draft);
    const request = JSON.parse(fetch.mock.calls[0][1].body);
    expect(request.model).toBe("test-vision");
    expect(request.messages[1].content[0].image_url.url).toBe(
      `data:image/png;base64,${file.buffer.toString("base64")}`,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    undefined,
    { ...file, mimetype: "image/jpeg" },
    { ...file, buffer: Buffer.from("not an image") },
    { ...file, buffer: Buffer.alloc(10 * 1024 * 1024 + 1) },
  ])("rejects invalid uploads before contacting AI", async (upload) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(new PictureImportService(env).extract("inventory", upload)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { ...draft, organizationId: "other-tenant" },
    { ...draft, items: [{ ...draft.items[0], quantity: -1 }] },
    { ...draft, items: [{ ...draft.items[0], quantity: 1.5 }] },
    { ...draft, items: [{ ...draft.items[0], unitPriceNaira: 20000001 }] },
    { ...draft, items: [{ ...draft.items[0], productId: "invented-id" }] },
    { ...draft, items: Array(51).fill(draft.items[0]) },
  ])("rejects untrusted or unsafe extraction output", async (content) => {
    vi.stubGlobal("fetch", provider(content));
    await expect(new PictureImportService(env).extract("sales", file)).rejects.toThrow(
      "couldn't read",
    );
  });
  it("reports missing provider configuration without calling AI", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(new PictureImportService({} as ApiEnv).extract("sales", file)).rejects.toThrow(
      "not configured",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("handles timeouts and provider outages without returning a saveable draft", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    await expect(new PictureImportService(env).extract("sales", file)).rejects.toThrow(
      "couldn't read",
    );
  });
  it("checks write access to the requested organization before extraction", async () => {
    const authorize = vi.fn().mockRejectedValue(new Error("Forbidden"));
    const extract = vi.fn();
    const controller = new PictureImportController(
      { authorize } as unknown as BusinessAuthService,
      { extract } as unknown as PictureImportService,
    );
    await expect(
      controller.extract("other-tenant", { headers: {} } as Request, { purpose: "sales" }, file),
    ).rejects.toThrow("Forbidden");
    expect(authorize).toHaveBeenCalledWith(expect.any(Headers), "other-tenant", true, "sales");
    expect(extract).not.toHaveBeenCalled();
  });
  it("rejects unsupported extraction purposes", async () => {
    const body = Object.assign(new ExtractPictureDto(), { purpose: "delete-products" });
    expect(await validate(body)).toHaveLength(1);
  });
});

describe("expense picture drafts", () => {
  const expense = {
    description: "Office supplies",
    amountNaira: 12500.5,
    date: "2026-09-25",
    category: "Office supplies",
    paymentMethod: "card",
  };
  it("returns one receipt total without turning it into sale line items", async () => {
    const result = { expense, warnings: [] };
    const fetch = provider(result);
    vi.stubGlobal("fetch", fetch);
    await expect(new PictureImportService(env).extract("expenses", file)).resolves.toEqual(result);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves unknown amounts, dates, categories and payment methods for manual review", async () => {
    const result = {
      expense: {
        description: "Shop receipt",
        amountNaira: null,
        date: null,
        category: null,
        paymentMethod: null,
      },
      warnings: ["Total is unreadable"],
    };
    vi.stubGlobal("fetch", provider(result));
    await expect(new PictureImportService(env).extract("expenses", file)).resolves.toEqual(result);
  });
  it("returns no expense for an unrelated picture or multiple receipts", async () => {
    const result = { expense: null, warnings: ["Upload one receipt"] };
    vi.stubGlobal("fetch", provider(result));
    await expect(new PictureImportService(env).extract("expenses", file)).resolves.toEqual(result);
  });
  it.each([
    { amountNaira: -1 },
    { amountNaira: 0 },
    { amountNaira: 20000001 },
    { date: "2026-02-30" },
    { date: "25/09/2026" },
    { paymentMethod: "invented" },
    { categoryId: "other-tenant-category" },
    { organizationId: "other-tenant" },
  ])("rejects unsafe expense facts and invented IDs", async (patch) => {
    vi.stubGlobal("fetch", provider({ expense: { ...expense, ...patch }, warnings: [] }));
    await expect(new PictureImportService(env).extract("expenses", file)).rejects.toThrow(
      "couldn't read",
    );
  });
  it("accepts expenses as a validated extraction purpose", async () => {
    expect(
      await validate(Object.assign(new ExtractPictureDto(), { purpose: "expenses" })),
    ).toHaveLength(0);
  });
});
