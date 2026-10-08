import { Inject, Injectable } from "@nestjs/common";
import { eq } from "@nomidat/db";
import { businessProfile } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";

/**
 * Business profile: the details that appear on invoices.
 *
 * There is deliberately no per-tenant Paystack secret here. The platform holds
 * the merchant relationship and pays tenants out from its own balance, so a key
 * stored against an organisation would never be read by the payment path. It was
 * previously accepted and reported as "connected", which told a tenant their key
 * was in use while the platform key was what actually charged.
 */
@Injectable()
export class BusinessProfileService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async getStatus(organizationId: string) {
    const [profile] = await this.db
      .select({ updatedAt: businessProfile.updatedAt })
      .from(businessProfile)
      .where(eq(businessProfile.organizationId, organizationId))
      .limit(1);
    return { hasProfile: Boolean(profile) };
  }
}
