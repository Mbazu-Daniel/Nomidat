import { Inject, Injectable } from "@nestjs/common";
import { BETTER_AUTH, type BetterAuthInstance } from "../../common/better-auth";
import type { SignUpDto } from "./dto/sign-up.dto";
import type { SignInDto } from "./dto/sign-in.dto";

@Injectable()
export class AuthService {
  constructor(
    @Inject(BETTER_AUTH) private readonly betterAuth: BetterAuthInstance,
  ) {}

  async createUserWithEmail(body: SignUpDto, headers: Headers) {
    const localPart = body.email.split("@")[0];
    const name =
      body.name || localPart.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    return this.betterAuth.api.signUpEmail({
      body: {
        name,
        email: body.email,
        password: body.password,
        callbackURL: body.callbackURL,
      },
      headers,
      asResponse: true,
    });
  }

  async createSessionWithEmail(body: SignInDto, headers: Headers) {
    return this.betterAuth.api.signInEmail({
      body: {
        email: body.email,
        password: body.password,
        callbackURL: body.callbackURL,
        rememberMe: body.rememberMe ?? true,
      },
      headers,
      asResponse: true,
    });
  }

  async getSession(headers: Headers) {
    return this.betterAuth.api.getSession({
      headers,
      query: {},
      asResponse: true,
    });
  }

  async deleteSession(headers: Headers) {
    return this.betterAuth.api.signOut({
      headers,
      asResponse: true,
    });
  }

  async getSessions(headers: Headers) {
    return this.betterAuth.api.listSessions({
      headers,
      asResponse: true,
    });
  }
}
