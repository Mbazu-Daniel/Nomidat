// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { api, render, change, submit, click, button } from "./render";
import { StaffPanel } from "../staff-panel";
import { StaffMemberRow } from "../staff-member-row";
import { AcceptInvitation } from "../accept-invitation";
import { InvitationInbox } from "../invitation-inbox";
import { PhoneSignIn } from "../../auth/phone-sign-in";
import { BusinessAccessActions } from "../business-access-actions";
const member = {
  id: "member",
  userId: "staff",
  role: "staff",
  user: { name: "Ada", email: "ada@example.test" },
};
describe("staff access", () => {
  it("cannot edit your own role, an owner, or any member as ordinary staff", async () => {
    const ui = await render(StaffMemberRow, {
      member,
      access: { userId: "staff", role: "owner" },
      busy: false,
      onChange: vi.fn(),
      onRemove: vi.fn(),
    });
    expect(ui.querySelector("select")).toBeNull();
    expect(button(ui, "Remove")).toBeNull();
  });
  it("lets an owner save scoped permissions and requires a separate removal confirmation", async () => {
    const onChange = vi.fn(),
      onRemove = vi.fn();
    const ui = await render(StaffMemberRow, {
      member,
      access: { userId: "owner", role: "owner" },
      busy: false,
      onChange,
      onRemove,
    });
    await click(ui.querySelector('input[type="checkbox"]'));
    await click(button(ui, "Save role"));
    expect(onChange).toHaveBeenCalledWith("member", "staff,inventory_writer");
    await click(button(ui, "Remove"));
    expect(onRemove).not.toHaveBeenCalled();
    await click(button(ui, "Yes, remove"));
    expect(onRemove).toHaveBeenCalledWith("member");
  });
  it("does not fetch invitations or expose management forms to read-only staff", async () => {
    api.mockImplementation(async (path) =>
      path.endsWith("/access")
        ? { userId: "staff", role: "staff" }
        : { members: [member], total: 1 },
    );
    const ui = await render(StaffPanel, { organizationId: "shop" });
    expect(button(ui, "Add staff")).toBeNull();
    expect(ui.textContent).not.toContain("Invite staff by phone number");
    expect(api.mock.calls.some(([path]) => path.endsWith("/invitations"))).toBe(false);
  });
  it("creates a phone invitation containing only the permissions selected by the owner", async () => {
    api.mockImplementation(async (path) =>
      path.endsWith("/access")
        ? { userId: "owner", role: "owner" }
        : path.includes("/members")
          ? { members: [member], total: 1 }
          : [],
    );
    const ui = await render(StaffPanel, { organizationId: "shop" });
    const form = ui.querySelector<HTMLFormElement>("details form");
    await change(form!.querySelector('[name="phoneNumber"]'), "+2348012345678");
    await click(form!.querySelector('input[type="checkbox"]'));
    await submit(form);
    expect(api).toHaveBeenCalledWith("/organizations/shop/phone-invitations", {
      method: "POST",
      body: '{"phoneNumber":"+2348012345678","roles":["staff","inventory_writer"]}',
    });
    expect(ui.textContent).toContain("Invitation created.");
  });
  it("does not load an email invitation for an unverified account", async () => {
    api.mockResolvedValue({
      user: { id: "user", email: "ada@example.test", emailVerified: false },
    });
    const ui = await render(AcceptInvitation, { invitationId: "invite" });
    expect(ui.textContent).toContain("not verified yet");
    expect(button(ui, "Accept invitation")).toBeNull();
    expect(api).toHaveBeenCalledTimes(1);
  });
  it("does not offer acceptance of an expired invitation", async () => {
    api.mockImplementation(async (path) =>
      path === "/auth/session"
        ? { user: { id: "user", email: "ada@example.test", emailVerified: true } }
        : {
            id: "invite",
            email: "ada@example.test",
            role: "staff",
            status: "pending",
            expiresAt: "2020-01-01",
          },
    );
    const ui = await render(AcceptInvitation, { invitationId: "invite" });
    expect(ui.textContent).toContain("expired");
    expect(button(ui, "Accept invitation")).toBeNull();
  });
  it("removes a declined invitation after the server confirms rejection", async () => {
    api.mockResolvedValue([
      {
        id: "invite",
        email: "ada@example.test",
        role: "staff",
        status: "pending",
        expiresAt: "2099-01-01",
      },
    ]);
    const ui = await render(InvitationInbox, { verified: true });
    api.mockResolvedValue({});
    await click(button(ui, "Decline"));
    expect(api).toHaveBeenLastCalledWith("/invitations/invite/reject", {
      method: "POST",
      body: "{}",
    });
    expect(ui.textContent).toContain("No pending invitations");
  });
  it("locks the invited phone while entering OTP and shows verification failures", async () => {
    api.mockResolvedValue({});
    const ui = await render(PhoneSignIn, {});
    await change(ui.querySelector('[type="tel"]'), "+2348012345678");
    await submit(ui.querySelector("form"));
    expect(api).toHaveBeenLastCalledWith("/auth/phone-number/send-otp", {
      method: "POST",
      body: '{"phoneNumber":"+2348012345678"}',
    });
    expect(ui.querySelector<HTMLInputElement>('[type="tel"]')?.disabled).toBe(true);
    await change(ui.querySelector('[autocomplete="one-time-code"]'), "123456");
    api.mockRejectedValueOnce(new Error("Invalid code"));
    await submit(ui.querySelector("form"));
    expect(ui.textContent).toContain("Invalid code");
    await click(button(ui, "Change number or request a new code"));
    await submit(ui.querySelector("form"));
    expect(ui.textContent).toContain("Please wait a minute");
  });
  it("requires the exact confirmation before leaving and never offers deletion to staff", async () => {
    const ui = await render(BusinessAccessActions, { organizationId: "shop", owner: false });
    expect(button(ui, "Delete business")).toBeNull();
    await click(button(ui, "Leave business"));
    await submit(ui.querySelector("form"));
    expect(api).not.toHaveBeenCalled();
    await change(ui.querySelector("input"), "LEAVE");
    api.mockRejectedValueOnce(new Error("Last owner cannot leave"));
    await submit(ui.querySelector("form"));
    expect(api).toHaveBeenLastCalledWith("/organizations/shop/leave", { method: "POST" });
    expect(ui.textContent).toContain("Last owner cannot leave");
  });
});
