import { Global, Module } from "@nestjs/common";
import { apiEnvSchema } from "./env";

export const API_ENV = Symbol("API_ENV");

@Global()
@Module({
  providers: [
    {
      provide: API_ENV,
      useFactory: () => apiEnvSchema.parse(process.env),
    },
  ],
  exports: [API_ENV],
})
export class EnvModule {}
