import { assignableRoles } from "../../../common/better-auth/organization-permissions";
import { Type } from "class-transformer";
import { IsInt, IsIn, IsNotEmpty, IsUUID, IsOptional, IsString, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ListMembersQueryDto {
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
  @IsString()
  sortDirection?: "asc" | "desc";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filterField?: string;

  @ApiPropertyOptional({
    enum: [
      "eq",
      "ne",
      "lt",
      "lte",
      "gt",
      "gte",
      "in",
      "not_in",
      "contains",
      "starts_with",
      "ends_with",
    ],
  })
  @IsOptional()
  @IsString()
  filterOperator?: string;

  @ApiPropertyOptional()
  @IsOptional()
  filterValue?: string | number | boolean;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] })
  @IsNotEmpty()
  @IsIn(assignableRoles, { each: true })
  role!: string | string[];
}

export class AddMemberDto {
  @ApiPropertyOptional({ nullable: true })
  @IsUUID()
  userId!: string;

  @ApiProperty({ oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] })
  @IsNotEmpty()
  @IsIn(assignableRoles, { each: true })
  role!: string | string[];
}
