import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";
import { Module } from "@nestjs/common";
import { BusinessModule } from "../business/business.module";
import { DbModule } from "../../common/db/db.module";

@Module({
  imports: [BusinessModule, DbModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
