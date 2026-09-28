import { Module } from "@nestjs/common";
import { BusinessModule } from "../business/business.module";
import { PictureImportController } from "./picture-import.controller";
import { PictureImportService } from "./picture-import.service";

@Module({
  imports: [BusinessModule],
  controllers: [PictureImportController],
  providers: [PictureImportService],
  exports: [PictureImportService],
})
export class PictureImportModule {}
