// @vitest-environment happy-dom
import { it, expect, vi } from "vitest";
import { api, render, change, submit } from "./render";
import { CreateBusiness } from "../create-business";
import { OverviewPanel } from "../overview-panel";
  it("shows overview totals from the selected business", async () => {
    api.mockResolvedValue({
      salesTotalKobo: 120000,
      outstandingCreditKobo: 20000,
      expensesTotalKobo: 10000,
      customerCount: 1,
      productCount: 4,
      lowStockCount: 2,
    });
    const ui = await render(OverviewPanel, { organizationId: "shop" });
    expect(api).toHaveBeenCalledWith("/organizations/shop/summary");
    expect(ui.textContent).toContain("1,200");
    expect(ui.textContent).toContain("2 need a restock");
  });
  it("creates a business with trimmed shop details and omits optional empty fields", async () => {
    const created = vi.fn();
    api.mockResolvedValue({ id: "shop", name: "Ada shop" });
    const ui = await render(CreateBusiness, { onCreated: created });
    await change(ui.querySelector('[name="name"]'), " Ada shop ");
    await change(ui.querySelector('[name="phone"]'), "+2348012345678");
    await change(ui.querySelector('[name="ownerName"]'), "Ada");
    await change(ui.querySelector('[name="address"]'), "10 Market Road");
    await submit(ui.querySelector("form"));
    const call = api.mock.calls.find(
      ([path, init]) => path === "/organizations" && init?.method === "POST",
    )!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      name: "Ada shop",
      slug: "ada-shop",
      businessDetails: { ownerName: "Ada", phone: "+2348012345678", address: "10 Market Road" },
    });
    expect(created).toHaveBeenCalledWith({ id: "shop", name: "Ada shop" });
  });
