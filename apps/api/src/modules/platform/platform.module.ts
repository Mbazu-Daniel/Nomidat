import { PlatformAdminGuard } from "./platform-admin.guard";
import { PlatformController } from "./platform.controller";
import { PlatformDatabaseService } from "./platform-database.service";
import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { BetterAuthModule } from "../../common/better-auth/better-auth.module";
import { DbModule } from "../../common/db/db.module";
import { EnvModule } from "../../common/config/env.module";

@Module({
  imports: [AuditModule, BetterAuthModule, DbModule, EnvModule],
  controllers: [PlatformController],
  providers: [PlatformAdminGuard, PlatformDatabaseService],
})
export class PlatformModule {}
