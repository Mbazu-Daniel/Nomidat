import { Injectable } from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { SignInSocialDto } from "./dto/sign-in-social.dto";
import type { LinkSocialDto } from "./dto/link-social.dto";

@Injectable()
export class AuthSocialService {
  constructor(private readonly authService: AuthService) {}

  async signInSocial(body: SignInSocialDto, headers: Headers) {
    return this.authService.auth.api.signInSocial({
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

  async signInWithGoogle(
    body: Omit<SignInSocialDto, "provider">,
    headers: Headers,
  ) {
    return this.signInSocial({ ...body, provider: "google" }, headers);
  }

  async linkSocial(body: LinkSocialDto, headers: Headers) {
    return this.authService.auth.api.linkSocialAccount({
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

  async linkGoogle(
    body: Omit<LinkSocialDto, "provider">,
    headers: Headers,
  ) {
    return this.linkSocial({ ...body, provider: "google" }, headers);
  }
}
