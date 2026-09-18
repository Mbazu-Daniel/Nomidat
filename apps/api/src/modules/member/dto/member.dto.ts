import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ListMembersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({ example: "createdAt" })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDirection?: "asc" | "desc";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filterField?: string;

  @ApiPropertyOptional({
    enum: ["eq", "ne", "lt", "lte", "gt", "gte", "in", "not_in", "contains", "starts_with", "ends_with"],
  })
  @IsOptional()
  @IsString()
  filterOperator?: string;

  @ApiPropertyOptional()
  @IsOptional()
  filterValue?: string | number | boolean;
}

export class RemoveMemberDto {
  @ApiProperty({ description: "Member id or email" })
  @IsString()
  @IsNotEmpty()
  memberIdOrEmail!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] })
  @IsNotEmpty()
  role!: string | string[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  memberId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class AddMemberDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  userId?: string | null;

  @ApiProperty({ oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] })
  @IsNotEmpty()
  role!: string | string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class LeaveOrganizationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  organizationId!: string;
}
