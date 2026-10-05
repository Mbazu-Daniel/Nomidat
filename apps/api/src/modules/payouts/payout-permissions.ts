import { ForbiddenException } from "@nestjs/common";

// Writer roles are excluded on purpose: creating sales is not the same power as
// redirecting the business's whole balance to a bank account of your choosing.
const PAYOUT_ADMIN_ROLES = new Set(["owner", "admin", "manager"]);

export function assertCanManagePayouts(role: string): void {
  const allowed = role
    .split(",")
    .map((value) => value.trim())
    .some((value) => PAYOUT_ADMIN_ROLES.has(value));

  if (!allowed) {
    throw new ForbiddenException("Only an owner, admin or manager can change the payout account.");
  }
}
