import { Controller, Post, Get, Body, Req, Res } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import type { Request, Response as ExpressResponse } from "express";
import { AuthService } from "./auth.service";
import { SignUpDto, SignInDto } from "./dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("sign-up/email")
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({ status: 201, description: "User created successfully" })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 409, description: "User already exists" })
  async signUp(
    @Body() body: SignUpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const headers = this.extractHeaders(req);
    const response = await this.authService.signUpEmail(body, headers);

    this.forwardCookies(res, response);
    return this.readBody(response);
  }

  @Post("sign-in/email")
  @ApiOperation({ summary: "Sign in with email and password" })
  @ApiResponse({ status: 200, description: "Signed in successfully" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async signIn(
    @Body() body: SignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const headers = this.extractHeaders(req);
    const response = await this.authService.signInEmail(body, headers);

    this.forwardCookies(res, response);
    return this.readBody(response);
  }

  @Get("session")
  @ApiOperation({ summary: "Get current session" })
  @ApiResponse({ status: 200, description: "Session returned" })
  @ApiResponse({ status: 401, description: "Not authenticated" })
  async session(
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const headers = this.extractHeaders(req);
    const response = await this.authService.getSession(headers);

    this.forwardCookies(res, response);
    return this.readBody(response);
  }

  @Post("sign-out")
  @ApiOperation({ summary: "Sign out" })
  @ApiResponse({ status: 200, description: "Signed out" })
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: ExpressResponse) {
    const headers = this.extractHeaders(req);
    const response = await this.authService.signOut(headers);

    this.forwardCookies(res, response);
    return this.readBody(response);
  }

  @Get("sessions")
  @ApiOperation({ summary: "List all sessions" })
  @ApiResponse({ status: 200, description: "Sessions returned" })
  async sessions(@Req() req: Request) {
    const headers = this.extractHeaders(req);
    const response = await this.authService.listSessions(headers);

    return this.readBody(response);
  }

  private forwardCookies(res: ExpressResponse, upstream: globalThis.Response): void {
    const cookies = upstream.headers.getSetCookie?.() ?? [];
    for (const cookie of cookies) {
      res.append("Set-Cookie", cookie);
    }
  }

  private async readBody(response: globalThis.Response): Promise<unknown> {
    if (response.status === 204) {
      return null;
    }
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private extractHeaders(req: Request): Headers {
    const headers = new globalThis.Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined) {
        headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
      }
    }
    return headers;
  }
}
