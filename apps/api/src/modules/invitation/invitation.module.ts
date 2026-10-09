import { PhoneInvitationController } from "./phone-invitation.controller";
import { PhoneInvitationService } from "./phone-invitation.service";
import { DbModule } from "../../common/db/db.module";
import { OrganizationSummaryModule } from "../organization-summary/organization-summary.module";
import { Module } from "@nestjs/common";
import { InvitationController } from "./invitation.controller";
import { InvitationService } from "./invitation.service";

@Module({
  imports: [DbModule, OrganizationSummaryModule],
  controllers: [InvitationController, PhoneInvitationController],
  providers: [InvitationService, PhoneInvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
