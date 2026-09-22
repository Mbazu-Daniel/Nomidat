import type { Request } from "express";
import { extractHeaders } from "./auth-http";
import type { BusinessAuthService } from "../../modules/business/business-auth.service";

export function getOrganizationSession(auth: BusinessAuthService, req: Request, organizationId: string) {
  return auth.getSession(extractHeaders(req), organizationId);
}

export function authorizeOrganization(
  auth: BusinessAuthService,
  req: Request,
  organizationId: string,
) {
  return auth.getSession(extractHeaders(req), organizationId);
}
