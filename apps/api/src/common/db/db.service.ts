import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { DATABASE, type DbHandle } from "./db.provider";

@Injectable()
export class DbService implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly handle: DbHandle) {}

  async onApplicationShutdown(): Promise<void> {
    await this.handle.client.end({ timeout: 5 });
  }
}
