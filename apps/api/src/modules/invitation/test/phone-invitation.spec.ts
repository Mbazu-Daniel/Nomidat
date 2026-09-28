import { describe, expect, it, vi } from "vitest";
import { createDbStub } from "../../../common/db/test/db.stub";
import { PhoneInvitationService } from "../phone-invitation.service";
import type { BetterAuthInstance } from "../../../common/better-auth";
import type { ApiEnv } from "../../../common/config/env";
import type { BusinessAuthService } from "../../business/business-auth.service";
const person = { id: "staff", phoneNumber: "+2348012345678", phoneNumberVerified: true };
const invite = {
  id: "invite",
  phoneNumber: person.phoneNumber,
  organizationId: "shop",
  inviterId: "owner",
  role: "staff,expenses_writer",
  status: "pending",
  expiresAt: new Date("2099-01-01"),
};
function setup(rows: unknown[][]) {
  const stub = createDbStub(rows);
  const getSession = vi.fn().mockResolvedValue({ user: { id: person.id } });
  const service = new PhoneInvitationService(
    stub.db,
    { api: { getSession } } as unknown as BetterAuthInstance,
    { WEB_ORIGIN: "https://shop.test" } as ApiEnv,
    {} as BusinessAuthService,
  );
  return { ...stub, service, getSession };
}
describe("verified phone invitation acceptance", () => {
  it("rejects a foreign origin before reading the session", async () => {
    const { service, getSession } = setup([]);
    await expect(
      service.respond(new Headers({ origin: "https://attacker.test" }), "invite", true),
    ).rejects.toThrow("Untrusted");
    expect(getSession).not.toHaveBeenCalled();
  });
  it("rejects unverified phones and invitations belonging to another phone", async () => {
    const unverified = setup([[{ ...person, phoneNumberVerified: false }]]);
    await expect(unverified.service.respond(new Headers(), "invite", true)).rejects.toThrow(
      "Verify your phone",
    );
    const other = setup([[person], [{ ...invite, phoneNumber: "+2348099999999" }]]);
    await expect(other.service.respond(new Headers(), "invite", true)).rejects.toThrow(
      "another phone",
    );
    expect(other.inserts).not.toHaveBeenCalled();
  });
  it("rejects expired and already handled invitations", async () => {
    for (const row of [
      { ...invite, expiresAt: new Date(0) },
      { ...invite, status: "accepted" },
    ]) {
      const { service, inserts } = setup([[person], [row]]);
      await expect(service.respond(new Headers(), "invite", true)).rejects.toThrow(
        "already handled",
      );
      expect(inserts).not.toHaveBeenCalled();
    }
  });
  it("checks the inviter still manages the business", async () => {
    const { service, inserts } = setup([[person], [invite], [{ role: "staff" }]]);
    await expect(service.respond(new Headers(), "invite", true)).rejects.toThrow(
      "no longer manages",
    );
    expect(inserts).not.toHaveBeenCalled();
  });
  it("preserves existing membership permissions instead of overwriting them", async () => {
    const { service, inserts, updates } = setup([
      [person],
      [invite],
      [{ role: "owner" }],
      [{ role: "manager" }],
    ]);
    await expect(service.respond(new Headers(), "invite", true)).resolves.toEqual({
      organizationId: "shop",
    });
    expect(inserts).not.toHaveBeenCalled();
    expect(updates).toHaveBeenCalledWith({ status: "accepted" });
  });
  it("adds a new member with exactly the invited permissions", async () => {
    const { service, inserts } = setup([[person], [invite], [{ role: "owner" }], []]);
    await service.respond(new Headers(), "invite", true);
    expect(inserts).toHaveBeenCalledWith({
      organizationId: "shop",
      userId: "staff",
      role: "staff,expenses_writer",
    });
  });
  it("rejects an invitation without creating membership", async () => {
    const { service, inserts, updates } = setup([[person], [invite]]);
    await service.respond(new Headers(), "invite", false);
    expect(inserts).not.toHaveBeenCalled();
    expect(updates).toHaveBeenCalledWith({ status: "rejected" });
  });
});
