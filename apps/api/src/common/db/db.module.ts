import { Module } from "@nestjs/common";
import { DATABASE, dbProvider } from "./db.provider";
import { DbService } from "./db.service";

@Module({
  providers: [dbProvider, DbService],
  exports: [DATABASE, dbProvider],
})
export class DbModule {}
