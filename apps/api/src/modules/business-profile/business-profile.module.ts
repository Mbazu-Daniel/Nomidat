import { Module } from "@nestjs/common";
import { DbModule } from "../../common/db/db.module";
import { BusinessModule } from "../business/business.module";
import { BusinessProfileController } from "./business-profile.controller";
import { BusinessProfileService } from "./business-profile.service";

@Module({
  imports: [DbModule, BusinessModule],
  providers: [BusinessProfileService],
  controllers: [BusinessProfileController],
  exports: [BusinessProfileService],
})
export class BusinessProfileModule {}
