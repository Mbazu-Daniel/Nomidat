// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { api, render, change, click, button, submit } from "./render";
import { SettingsPanel } from "../settings-panel";
import { AccountPanel } from "../account-panel";
import { ExpenseCategories } from "../expense-categories";
import { BusinessProfileEditor } from "../business-profile-editor";
import { ReportsPanel } from "../reports-panel";
const profile = {
  id: "shop",
  name: "Ada shop",
  slug: "ada",
  metadata: JSON.stringify({
    businessDetails: { address: "10 Market Road", phone: "08012345678" },
  }),
};
describe("settings", () => {
  it("disables business details for staff and retains saved contact details", async () => {
    api.mockResolvedValue(profile);
    const ui = await render(BusinessProfileEditor, { organizationId: "shop", canManage: false });
    expect(ui.querySelector("fieldset")?.disabled).toBe(true);
    expect(ui.querySelector<HTMLInputElement>('[name="address"]')?.value).toBe("10 Market Road");
    expect(button(ui, "Save business details")).toBeNull();
  });
  it("saves the complete business profile and retains values after a server error", async () => {
    api.mockResolvedValue(profile);
    const ui = await render(BusinessProfileEditor, { organizationId: "shop", canManage: true });
    await change(ui.querySelector('[name="phone"]'), "08099999999");
    api.mockRejectedValueOnce(new Error("Try later"));
    await submit(ui.querySelector("form"));
    expect(
      JSON.parse(String(api.mock.calls.at(-1)?.[1]?.body)).data.metadata.businessDetails.phone,
    ).toBe("08099999999");
    expect(ui.textContent).toContain("Try later");
    expect(ui.querySelector("fieldset")?.disabled).toBe(false);
  });
  it("only shows allowed settings and switches to payment settings for owners", async () => {
    api.mockImplementation(async (path) =>
      path.endsWith("/access")
        ? { role: "owner" }
        : path.endsWith("/business-profile")
          ? { paystackConnected: false }
          : profile,
    );
    const ui = await render(SettingsPanel, { organizationId: "shop" });
    await click(ui.querySelector('[role="combobox"]'));
    const option = [...document.querySelectorAll('[role="option"]')].find((node) =>
      node.textContent?.includes("Payment settings"),
    );
    expect(option).toBeDefined();
    await click(option!);
    expect(ui.querySelector('[name="key"]')).not.toBeNull();
    expect(ui.querySelector('[name="address"]')).toBeNull();
    await change(ui.querySelector('[name="key"]'), "sk_test_example");
    await submit(ui.querySelector("form"));
    expect(api).toHaveBeenCalledWith("/organizations/shop/business-profile/payment-key", {
      method: "PUT",
      body: '{"secretKey":"sk_test_example"}',
    });
    expect(ui.textContent).toContain("Paystack key saved");
  });
  it("shows account sessions and rejects insecure social sign-in redirects", async () => {
    api.mockImplementation(async (path) =>
      path === "/auth/session"
        ? {
            user: { id: "user", email: "ada@example.test", name: "Ada", emailVerified: false },
            session: { id: "current" },
          }
        : path === "/auth/sessions"
          ? [
              {
                id: "current",
                createdAt: "2026-09-24",
                expiresAt: "2026-10-24",
                userAgent: "Test browser",
              },
            ]
          : { url: "http://unsafe.example" },
    );
    const ui = await render(AccountPanel, {});
    expect(ui.textContent).toContain("This session");
    expect(ui.textContent).toContain("Test browser");
    await click(button(ui, "Link Google account"));
    expect(ui.textContent).toContain("Invalid sign-in URL");
  });
  it("creates an expense category and refreshes the list", async () => {
    api.mockResolvedValue([]);
    const ui = await render(ExpenseCategories, { organizationId: "shop", canWrite: true });
    await change(ui.querySelector('input[name="name"]'), "Delivery");
    await submit(ui.querySelector("form"));
    expect(api).toHaveBeenCalledWith("/organizations/shop/expense-categories", {
      method: "POST",
      body: '{"name":"Delivery"}',
    });
  });
  it("reports failed report queries without displaying invented totals", async () => {
    api.mockRejectedValue(new Error("Reports unavailable"));
    const ui = await render(ReportsPanel, { organizationId: "shop" });
    expect(ui.textContent).toContain("Could not load your reports");
    expect(api.mock.calls.length).toBe(6);
    expect(api.mock.calls.every(([path]) => path.includes("/organizations/shop/"))).toBe(true);
  });
});
