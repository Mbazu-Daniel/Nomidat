import { Module } from "@nestjs/common";
import { DbModule } from "../../common/db/db.module";
import { OrganizationSummaryModule } from "../organization-summary/organization-summary.module";
import { SalesModule } from "../sales/sales.module";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";

@Module({
  imports: [DbModule, OrganizationSummaryModule, SalesModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
