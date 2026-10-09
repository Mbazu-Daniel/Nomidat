import { Module } from "@nestjs/common";
import { OrganizationSummaryModule } from "../../modules/organization-summary/organization-summary.module";
import { FilesController } from "./files.controller";
import { FileStorageService } from "./file-storage.service";

/**
 * Global storage for uploaded files. Imported by `AppModule` once rather than by
 * each feature, because every feature that stores a picture goes through the same
 * service and the same key layout.
 *
 * `OrganizationSummaryModule` is imported for `OrganizationAuthService`, which the controller
 * needs to prove the caller may write to the organization in the route. Nest
 * resolves providers at boot, not at compile time, so a missing import here
 * passes typecheck and then fails the whole API on startup.
 */
@Module({
  imports: [OrganizationSummaryModule],
  controllers: [FilesController],
  providers: [FileStorageService],
  exports: [FileStorageService],
})
export class FilesModule {}
