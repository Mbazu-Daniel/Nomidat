import { Inject, Injectable } from "@nestjs/common";
import { createDb } from "@nomidat/db";
import { createAuth, API_VERSION_PATH, type Auth } from "../../common/config/better-auth.config";
import { API_ENV } from "../../common/config/env.module";
import type { ApiEnv } from "../../common/config/env";
import type { SignUpDto } from "./dto/sign-up.dto";
import type { SignInDto } from "./dto/sign-in.dto";

@Injectable()
export class AuthService {
  readonly auth: Auth;

  constructor(@Inject(API_ENV) env: ApiEnv) {
    const { db } = createDb(env.DATABASE_URL);

    this.auth = createAuth({
      db,
      secret: env.BETTER_AUTH_SECRET,
      baseURL: `${env.BETTER_AUTH_URL}${API_VERSION_PATH}`,
      webOrigin: env.WEB_ORIGIN,
      google:
        env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
          ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
          : undefined,
    });
  }

  async signUpEmail(body: SignUpDto, headers: Headers) {
    const localPart = body.email.split("@")[0];
    const name = body.name || localPart.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    return this.auth.api.signUpEmail({
      body: {
        name,
        email: body.email,
        password: body.password,
        image: body.image,
        callbackURL: body.callbackURL,
      },
      headers,
      asResponse: true,
    });
  }

  async signInEmail(body: SignInDto, headers: Headers) {
    return this.auth.api.signInEmail({
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
    return this.auth.api.getSession({
      headers,
      query: {},
      asResponse: true,
    });
  }

  async signOut(headers: Headers) {
    return this.auth.api.signOut({
      headers,
      asResponse: true,
    });
  }

  async listSessions(headers: Headers) {
    return this.auth.api.listSessions({
      headers,
      asResponse: true,
    });
  }
}
