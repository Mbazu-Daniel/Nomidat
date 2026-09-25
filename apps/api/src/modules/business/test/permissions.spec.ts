import { describe, expect, it } from "vitest";
import { BusinessAuthService } from "../business-auth.service";
import { actionWriteArea } from "../../conversational/action-permissions";
import { writeActions } from "../../conversational/action-schema";
describe("custom business permissions", () => {
  const authorize = BusinessAuthService.prototype.authorizeWrite;
  it("does not let a permission for one area grant writes in other areas", () => {
    for (const area of ["sales", "inventory", "expenses", "invoices", "customers", "channels"]) {
      expect(() => authorize("staff," + area + "_writer", area)).not.toThrow();
      for (const other of ["sales", "inventory", "expenses", "invoices", "customers", "channels"].filter((v) => v !== area))
        expect(() => authorize("staff," + area + "_writer", other)).toThrow();
    }
  });
  it("denies arbitrary roles and keeps owner/admin/manager access", () => {
    expect(() => authorize("staff", "sales")).toThrow();
    expect(() => authorize("sales_writer_fake", "sales")).toThrow();
    for (const role of ["owner", "admin", "manager"])
      expect(() => authorize(role, "sales")).not.toThrow();
  });
  it("maps every chat write intent and denies unknown future actions", () => {
    for (const intent of writeActions) expect(actionWriteArea(intent)).not.toBe("unsupported");
    expect(() => authorize("staff,sales_writer", actionWriteArea("new_action"))).toThrow();
  });
});
