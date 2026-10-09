import { OrganizationSummaryModule } from "../organization-summary/organization-summary.module";
import { Module } from "@nestjs/common";
import { MemberController } from "./member.controller";
import { MemberService } from "./member.service";

@Module({
  imports: [OrganizationSummaryModule],
  controllers: [MemberController],
  providers: [MemberService],
  exports: [MemberService],
})
export class MemberModule {}
