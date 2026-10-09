import { Module } from "@nestjs/common";
import { BetterAuthModule } from "../../common/better-auth/better-auth.module";
import { DbModule } from "../../common/db/db.module";
import { OrganizationSummaryModule } from "../organization-summary/organization-summary.module";
import { MemberProfileController } from "./member-profile.controller";
import { MemberProfileService } from "./member-profile.service";

/**
 * The signed-in person's own profile inside one business.
 *
 * Its own module because it is not about the business: the name and face here
 * belong to a member of an organization, which is a different thing from the
 * organization itself. It previously lived beside a dead `business_profile`
 * table; when that table was dropped the two were separated rather than deleted
 * together, because this one carries live routes.
 */
@Module({
  imports: [DbModule, OrganizationSummaryModule, BetterAuthModule],
  controllers: [MemberProfileController],
  providers: [MemberProfileService],
  exports: [MemberProfileService],
})
export class MemberProfileModule {}
