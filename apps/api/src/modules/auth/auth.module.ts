import { Global, MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthSocialService } from "./auth-social.service";
import { AuthTelegramService } from "./auth-telegram.service";
import { AuthController } from "./auth.controller";
import { AuthMiddleware } from "./auth.middleware";

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthSocialService, AuthTelegramService, AuthMiddleware],
  exports: [AuthService, AuthSocialService, AuthTelegramService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthMiddleware).forRoutes(
      { path: "auth/phone-number/{*splat}", method: RequestMethod.ALL },
      {
        path: "auth/callback/{*splat}",
        method: RequestMethod.ALL,
      },
    );
  }
}
