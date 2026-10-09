import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";
import { Module } from "@nestjs/common";
import { OrganizationSummaryModule } from "../organization-summary/organization-summary.module";
import { DbModule } from "../../common/db/db.module";

@Module({
  imports: [OrganizationSummaryModule, DbModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
