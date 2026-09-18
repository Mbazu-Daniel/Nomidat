import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
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
  role!: string | string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

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

export class GetInvitationQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id!: string;
}

export class ListInvitationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class ListUserInvitationsQueryDto {
  @ApiPropertyOptional({
    description: "Server-only: list invitations for a specific email",
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
