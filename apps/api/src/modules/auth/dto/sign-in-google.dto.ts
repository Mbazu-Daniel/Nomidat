import { OmitType } from "@nestjs/swagger";
import { SignInSocialDto } from "./sign-in-social.dto";

export class SignInGoogleDto extends OmitType(SignInSocialDto, ["provider"] as const) {}
