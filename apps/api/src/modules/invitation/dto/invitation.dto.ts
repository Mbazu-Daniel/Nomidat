import { assignableRoles } from "../../../common/better-auth/organization-permissions";
import { IsIn, IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class InviteMemberDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: "Role or roles to assign",
    oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
    example: "member",
  })
  @IsNotEmpty()
  @IsIn(assignableRoles, { each: true })
  role!: string | string[];

  @ApiPropertyOptional({ description: "Resend if already invited" })
  @IsOptional()
  @IsBoolean()
  resend?: boolean;
}

export class InvitationIdDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  invitationId!: string;
}

export class ListUserInvitationsQueryDto {
  @ApiPropertyOptional({
    description: "Server-only: list invitations for a specific email",
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
