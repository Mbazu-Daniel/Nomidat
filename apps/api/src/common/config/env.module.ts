import { Global, Module } from "@nestjs/common";
import { parseApiEnv } from "./env";

export const API_ENV = Symbol("API_ENV");

@Global()
@Module({
  providers: [
    {
      provide: API_ENV,
      useFactory: () => parseApiEnv(),
    },
  ],
  exports: [API_ENV],
})
export class EnvModule {}
