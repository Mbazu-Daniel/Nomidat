import { describe, it, expect, vi } from "vitest";
import { createDbStub } from "../../../common/db/test/db.stub";
import { BusinessAuthService } from "../business-auth.service";
import type { BetterAuthInstance } from "../../../common/better-auth";
import type { ApiEnv } from "../../../common/config/env";
import { MemberController } from "../../member/member.controller";
import type { MemberService } from "../../member/member.service";
import type { Request, Response } from "express";
describe("business membership authorization", () => {
  it("rejects foreign origins, absent sessions and absent memberships", async () => {
    const { db } = createDbStub([[]]);
    const getSession = vi.fn();
    const service = new BusinessAuthService(
      { api: { getSession } } as unknown as BetterAuthInstance,
      db,
      { WEB_ORIGIN: "https://shop.test" } as ApiEnv,
    );
    await expect(
      service.getSession(new Headers({ origin: "https://other.test" }), "shop"),
    ).rejects.toThrow("Untrusted");
    expect(getSession).not.toHaveBeenCalled();
    getSession.mockResolvedValue(null);
    await expect(service.getSession(new Headers(), "shop")).rejects.toThrow(
      "Authentication required",
    );
    getSession.mockResolvedValue({ user: { id: "user" } });
    await expect(service.getSession(new Headers(), "shop")).rejects.toThrow("Not a member");
  });
  it("uses current membership roles rather than session-provided permissions", async () => {
    const { db } = createDbStub([[{ role: "staff,expenses_writer" }]]);
    const service = new BusinessAuthService(
      {
        api: { getSession: vi.fn().mockResolvedValue({ user: { id: "user", role: "owner" } }) },
      } as unknown as BetterAuthInstance,
      db,
      { WEB_ORIGIN: "https://shop.test" } as ApiEnv,
    );
    const session = await service.getSession(new Headers(), "shop");
    expect(session).toEqual({ userId: "user", role: "staff,expenses_writer" });
    expect(() => service.authorizeWrite(session.role, "inventory")).toThrow();
  });
  it("prevents admins from creating owners and staff from adding members", async () => {
    const getSession = vi.fn().mockResolvedValue({ role: "admin" });
    const createOrganizationMember = vi.fn();
    const controller = new MemberController(
      { createOrganizationMember } as unknown as MemberService,
      { getSession } as unknown as BusinessAuthService,
    );
    const req = { headers: {} } as Request,
      res = {} as Response;
    await expect(
      controller.createOrganizationMember("shop", { userId: "user", role: ["owner"] }, req, res),
    ).rejects.toThrow("Only owners");
    getSession.mockResolvedValue({ role: "staff" });
    await expect(
      controller.createOrganizationMember("shop", { userId: "user", role: ["staff"] }, req, res),
    ).rejects.toThrow("Only owners and admins");
    expect(createOrganizationMember).not.toHaveBeenCalled();
  });
});
