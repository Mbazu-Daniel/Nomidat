import { Global, MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthSocialService } from "./auth-social.service";
import { AuthController } from "./auth.controller";
import { AuthMiddleware } from "./auth.middleware";

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthSocialService, AuthMiddleware],
  exports: [AuthService, AuthSocialService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // OAuth provider callbacks (e.g. Google) must hit better-auth's handler.
    consumer.apply(AuthMiddleware).forRoutes({
      path: "auth/callback/{*splat}",
      method: RequestMethod.ALL,
    });
  }
}
