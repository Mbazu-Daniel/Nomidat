import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { eq } from "@nomidat/db";
import { businessProfile, organization } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { API_ENV } from "../../common/config/env.module";
import type { ApiEnv } from "../../common/config/env";
import { decryptKey, encryptKey } from "./key-encryption";

@Injectable()
export class BusinessProfileService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async getStatus(organizationId: string) {
    const [profile] = await this.db
      .select({ key: businessProfile.providerSecretKeyEncrypted })
      .from(businessProfile)
      .where(eq(businessProfile.organizationId, organizationId))
      .limit(1);
    return { paystackConnected: Boolean(profile?.key) };
  }

  async updatePaymentKey(organizationId: string, key: string) {
    const [business] = await this.db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);
    if (!business) throw new NotFoundException("Business not found.");
    const encrypted = encryptKey(key, this.getEncryptionKey(), organizationId);
    await this.db
      .insert(businessProfile)
      .values({ organizationId, name: business.name, providerSecretKeyEncrypted: encrypted })
      .onConflictDoUpdate({
        target: businessProfile.organizationId,
        set: { providerSecretKeyEncrypted: encrypted, updatedAt: new Date() },
      });
    return { paystackConnected: true };
  }

  async getPaymentKey(organizationId: string) {
    const [profile] = await this.db
      .select({ key: businessProfile.providerSecretKeyEncrypted })
      .from(businessProfile)
      .where(eq(businessProfile.organizationId, organizationId))
      .limit(1);
    if (!profile?.key)
      throw new ServiceUnavailableException(
        "Connect this business's Paystack account in Settings first.",
      );
    return decryptKey(profile.key, this.getEncryptionKey(), organizationId);
  }

  private getEncryptionKey() {
    if (!this.env.ENCRYPTION_KEY)
      throw new ServiceUnavailableException("Payment key encryption is not configured.");
    return this.env.ENCRYPTION_KEY;
  }
}
