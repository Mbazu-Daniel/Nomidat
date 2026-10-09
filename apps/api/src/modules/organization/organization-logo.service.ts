import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { and, eq } from "@nomidat/db";
import { organization } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { FileStorageService } from "../../common/files/file-storage.service";

/**
 * The organization's own logo, stored in the bucket.
 *
 * Written directly rather than through Better Auth's `updateOrganization`, which
 * only knows about its own `logo` column. Going through Better Auth to set a
 * column it does not model would mean either storing a storage key in a field
 * every Better Auth caller expects to hold a URL, or a second table that exists
 * only to mirror one — which is what `business_profile` was.
 */
@Injectable()
export class OrganizationLogoService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly files: FileStorageService,
  ) {}

  /**
   * The logo to show, preferring the bucket over the legacy inline value.
   *
   * The data URL is still returned when it is the only one there: it is
   * Better Auth's column and predates the bucket, so an organization that set
   * its logo before has nothing else.
   */
  async getLogo(organizationId: string): Promise<{ logoUrl: string | null }> {
    const [row] = await this.db
      .select({ logoKey: organization.logoKey, logo: organization.logo })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);

    return { logoUrl: this.files.getPublicUrl(row?.logoKey) ?? row?.logo ?? null };
  }

  /**
   * Points the organization at a new logo, deleting the one it replaces.
   *
   * Ownership is checked against the organization the caller was authorized for
   * rather than by the shape of the key. Every key is unique, so a key minted for
   * one organization would otherwise render another organization's logo here
   * without ever being malformed.
   *
   * The old object is removed only after the row has moved on, so a failure
   * leaves a leaked object rather than an organization pointing at a logo that is
   * already gone.
   */
  async setLogo(organizationId: string, logoKey: string | null): Promise<void> {
    if (logoKey !== null && !logoKey.startsWith(`${organizationId}/`)) {
      throw new BadRequestException("That image does not belong to this organization.");
    }

    const [existing] = await this.db
      .select({ logoKey: organization.logoKey })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);
    if (!existing) throw new BadRequestException("Organization not found.");

    await this.db
      .update(organization)
      .set({ logoKey, updatedAt: new Date() })
      .where(and(eq(organization.id, organizationId)));

    if (existing.logoKey && existing.logoKey !== logoKey) {
      await this.files.deleteFile(organizationId, existing.logoKey);
    }
  }
}
