import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { getOrganizationSession, authorizeOrganization } from "../../common/helpers/organization-auth";
import { BusinessAuthService } from "../business/business-auth.service";
import { CreateExpenseCategoryDto, CreateExpenseDto, UpdateExpenseDto } from "./dto";
import { ExpensesService } from "./expenses.service";

@ApiTags("Expenses")
@Controller("organizations/:organizationId")
export class ExpensesController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly expenses: ExpensesService,
  ) {}

  @Post("expenses")
  @ApiOperation({ summary: "Record an expense" })
  async create(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateExpenseDto,
    @Req() req: Request,
  ) {
    const session = await getOrganizationSession(this.auth, req, organizationId);
    return this.expenses.create(organizationId, session.userId, body);
  }

  @Get("expenses")
  @ApiOperation({ summary: "List expenses" })
  @ApiQuery({ name: "limit", required: false, type: Number, maximum: 50 })
  async list(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    await this.authorize(req, organizationId);
    return this.expenses.list(organizationId, limit);
  }

  @Get("expenses/:expenseId")
  @ApiOperation({ summary: "Get an expense" })
  async get(
    @Param("organizationId") organizationId: string,
    @Param("expenseId") expenseId: string,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.expenses.get(organizationId, expenseId);
  }

  @Patch("expenses/:expenseId")
  @ApiOperation({ summary: "Update an expense" })
  async update(
    @Param("organizationId") organizationId: string,
    @Param("expenseId") expenseId: string,
    @Body() body: UpdateExpenseDto,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.expenses.update(organizationId, expenseId, body);
  }

  @Delete("expenses/:expenseId")
  @ApiOperation({ summary: "Delete an expense" })
  async remove(
    @Param("organizationId") organizationId: string,
    @Param("expenseId") expenseId: string,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.expenses.remove(organizationId, expenseId);
  }

  @Get("expense-categories")
  @ApiOperation({ summary: "List expense categories" })
  async listCategories(@Param("organizationId") organizationId: string, @Req() req: Request) {
    await this.authorize(req, organizationId);
    return this.expenses.listCategories(organizationId);
  }

  @Post("expense-categories")
  @ApiOperation({ summary: "Create an expense category" })
  async createCategory(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateExpenseCategoryDto,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.expenses.createCategory(organizationId, body);
  }

  private authorize(req: Request, organizationId: string) {
    return authorizeOrganization(this.auth, req, organizationId);
  }
}
