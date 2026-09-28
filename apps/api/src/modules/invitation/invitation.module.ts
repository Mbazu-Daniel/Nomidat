import { PhoneInvitationController } from "./phone-invitation.controller";
import { PhoneInvitationService } from "./phone-invitation.service";
import { DbModule } from "../../common/db/db.module";
import { BusinessModule } from "../business/business.module";
import { Module } from "@nestjs/common";
import { InvitationController } from "./invitation.controller";
import { InvitationService } from "./invitation.service";

@Module({
  imports: [DbModule, BusinessModule],
  controllers: [InvitationController, PhoneInvitationController],
  providers: [InvitationService, PhoneInvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
