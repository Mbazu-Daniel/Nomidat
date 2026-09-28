import { Module } from "@nestjs/common";
import { DbModule } from "../../common/db/db.module";
import { BusinessModule } from "../business/business.module";
import { ContactsController } from "./contacts.controller";
import { ContactsService } from "./contacts.service";

@Module({
  imports: [DbModule, BusinessModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
