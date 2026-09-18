import { Global, MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthSocialService } from "./auth-social.service";
// TODO(channels): re-enable with telegram auth service
// import { AuthTelegramService } from "./auth-telegram.service";
import { AuthController } from "./auth.controller";
import { AuthMiddleware } from "./auth.middleware";

@Global()
@Module({
  controllers: [AuthController],
  // TODO(channels): re-add AuthTelegramService to providers/exports once staged
  providers: [AuthService, AuthSocialService, AuthMiddleware],
  exports: [AuthService, AuthSocialService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthMiddleware).forRoutes({
      path: "auth/callback/{*splat}",
      method: RequestMethod.ALL,
    });
  }
}
