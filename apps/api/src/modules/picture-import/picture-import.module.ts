import { Module } from "@nestjs/common";
import { OrganizationSummaryModule } from "../organization-summary/organization-summary.module";
import { PictureImportController } from "./picture-import.controller";
import { PictureImportService } from "./picture-import.service";

@Module({
  imports: [OrganizationSummaryModule],
  controllers: [PictureImportController],
  providers: [PictureImportService],
  exports: [PictureImportService],
})
export class PictureImportModule {}
