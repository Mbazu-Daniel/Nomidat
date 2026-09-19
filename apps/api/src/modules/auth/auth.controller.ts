import { Controller, Post, Get, Body, Req, Res } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import type { Request, Response as ExpressResponse } from "express";
import { extractHeaders, proxyAuthResponse } from "../../common/helpers/auth-http";
import { AuthService } from "./auth.service";
import { AuthSocialService } from "./auth-social.service";
import { AuthTelegramService } from "./auth-telegram.service";
import {
  SignUpDto,
  SignInDto,
  SignInSocialDto,
  SignInGoogleDto,
  LinkSocialDto,
  CreateTelegramMiniAppSessionDto,
} from "./dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authSocialService: AuthSocialService,
    private readonly authTelegramService: AuthTelegramService,
  ) {}

  @Post("sign-up/email")
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({ status: 201, description: "User created successfully" })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 409, description: "An account with this email already exists" })
  async createUserWithEmail(
    @Body() body: SignUpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.authService.createUserWithEmail(body, extractHeaders(req)),
    );
  }

  @Post("sign-in/email")
  @ApiOperation({ summary: "Sign in with email and password" })
  @ApiResponse({ status: 200, description: "Signed in successfully" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async createSessionWithEmail(
    @Body() body: SignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.authService.createSessionWithEmail(body, extractHeaders(req)),
    );
  }

  @Post("sign-in/social")
  @ApiOperation({ summary: "Sign in with a social provider (Google)" })
  @ApiResponse({
    status: 200,
    description: "Returns an OAuth redirect URL, or a session when idToken is provided",
  })
  @ApiResponse({ status: 400, description: "Provider not configured or invalid request" })
  async createSessionWithSocial(
    @Body() body: SignInSocialDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.authSocialService.createSessionWithSocial(body, extractHeaders(req)),
    );
  }

  @Post("sign-in/google")
  @ApiOperation({ summary: "Sign in with Google" })
  @ApiResponse({
    status: 200,
    description: "Returns an OAuth redirect URL, or a session when idToken is provided",
  })
  async createSessionWithGoogle(
    @Body() body: SignInGoogleDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.authSocialService.createSessionWithGoogle(body, extractHeaders(req)),
    );
  }

  @Post("sign-in/telegram")
  @ApiOperation({ summary: "Sign in from a Telegram Mini App via initData" })
  @ApiResponse({ status: 200, description: "Session created from verified Telegram initData" })
  @ApiResponse({ status: 401, description: "Invalid or expired initData" })
  async createSessionWithTelegramMiniApp(
    @Body() body: CreateTelegramMiniAppSessionDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.authTelegramService.createSessionWithTelegramMiniApp(
        body.initData,
        extractHeaders(req),
      ),
    );
  }

  @Post("link-social")
  @ApiOperation({ summary: "Link a social provider to the current account" })
  @ApiResponse({ status: 200, description: "Returns an OAuth redirect URL or link status" })
  @ApiResponse({ status: 401, description: "Not authenticated" })
  async createSocialLink(
    @Body() body: LinkSocialDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.authSocialService.createSocialLink(body, extractHeaders(req)),
    );
  }

  @Get("session")
  @ApiOperation({ summary: "Get current session" })
  @ApiResponse({ status: 200, description: "Session returned" })
  @ApiResponse({ status: 401, description: "Not authenticated" })
  async getCurrentSession(@Req() req: Request, @Res({ passthrough: true }) res: ExpressResponse) {
    return proxyAuthResponse(res, await this.authService.getCurrentSession(extractHeaders(req)));
  }

  @Post("sign-out")
  @ApiOperation({ summary: "Sign out" })
  @ApiResponse({ status: 200, description: "Signed out" })
  async deleteCurrentSession(
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(res, await this.authService.deleteCurrentSession(extractHeaders(req)));
  }

  @Get("sessions")
  @ApiOperation({ summary: "List all sessions" })
  @ApiResponse({ status: 200, description: "Sessions returned" })
  async getUserSessions(@Req() req: Request, @Res({ passthrough: true }) res: ExpressResponse) {
    return proxyAuthResponse(res, await this.authService.getUserSessions(extractHeaders(req)));
  }
}
