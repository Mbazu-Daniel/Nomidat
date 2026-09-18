import { Inject, Injectable } from "@nestjs/common";
import { BETTER_AUTH, type BetterAuthInstance } from "../../common/better-auth";
import type { SignInSocialDto } from "./dto/sign-in-social.dto";
import type { LinkSocialDto } from "./dto/link-social.dto";

@Injectable()
export class AuthSocialService {
  constructor(
    @Inject(BETTER_AUTH) private readonly betterAuth: BetterAuthInstance,
  ) {}

  async createSessionWithSocial(body: SignInSocialDto, headers: Headers) {
    return this.betterAuth.api.signInSocial({
      body: {
        provider: body.provider,
        callbackURL: body.callbackURL,
        newUserCallbackURL: body.newUserCallbackURL,
        errorCallbackURL: body.errorCallbackURL,
        idToken: body.idToken,
        scopes: body.scopes,
        disableRedirect: body.disableRedirect,
        requestSignUp: body.requestSignUp,
        additionalParams: body.additionalParams,
      },
      headers,
      asResponse: true,
    });
  }

  async createSessionWithGoogle(
    body: Omit<SignInSocialDto, "provider">,
    headers: Headers,
  ) {
    return this.createSessionWithSocial({ ...body, provider: "google" }, headers);
  }

  async createSocialLink(body: LinkSocialDto, headers: Headers) {
    return this.betterAuth.api.linkSocialAccount({
      body: {
        provider: body.provider,
        callbackURL: body.callbackURL,
        errorCallbackURL: body.errorCallbackURL,
        idToken: body.idToken,
        scopes: body.scopes,
        disableRedirect: body.disableRedirect,
        additionalParams: body.additionalParams,
      },
      headers,
      asResponse: true,
    });
  }
}
