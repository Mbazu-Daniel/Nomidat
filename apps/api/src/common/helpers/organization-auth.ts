import type { Request } from "express";
import { extractHeaders } from "./auth-http";
import type { BusinessAuthService } from "../../modules/business/business-auth.service";

export async function authorizeOrganization(
  auth: BusinessAuthService,
  req: Request,
  organizationId: string,
  area?: string,
) {
  const session = await auth.getSession(extractHeaders(req), organizationId);
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) auth.authorizeWrite(session.role, area);
  return session;
}
