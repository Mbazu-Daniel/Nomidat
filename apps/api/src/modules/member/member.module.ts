import { BusinessModule } from "../business/business.module";
import { Module } from "@nestjs/common";
import { MemberController } from "./member.controller";
import { MemberService } from "./member.service";

@Module({
  imports: [BusinessModule],
  controllers: [MemberController],
  providers: [MemberService],
  exports: [MemberService],
})
export class MemberModule {}
