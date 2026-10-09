import { Module } from "@nestjs/common";
import { DbModule } from "../../common/db/db.module";
import { FilesModule } from "../../common/files/files.module";
import { OrganizationSummaryModule } from "../organization-summary/organization-summary.module";
import { OrganizationController } from "./organization.controller";
import { OrganizationLogoService } from "./organization-logo.service";
import { OrganizationService } from "./organization.service";

/**
 * DbModule and FilesModule are for the logo only. Everything else here is a
 * pass-through to Better Auth, which owns the organization row's identity and
 * membership.
 */
@Module({
  imports: [DbModule, FilesModule, OrganizationSummaryModule],
  controllers: [OrganizationController],
  providers: [OrganizationService, OrganizationLogoService],
  exports: [OrganizationService, OrganizationLogoService],
})
export class OrganizationModule {}
