import { Module } from "@nestjs/common";
import { EnvModule } from "./common/config/env.module";
import { DbModule } from "./common/db/db.module";
import { AuthModule } from "./modules/auth/auth.module";

@Module({
  imports: [EnvModule, DbModule, AuthModule],
})
export class AppModule {}
