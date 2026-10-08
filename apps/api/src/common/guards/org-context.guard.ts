import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { BETTER_AUTH, type BetterAuthInstance } from "../better-auth";
import { DATABASE, type DbHandle } from "../db/db.provider";
import { extractHeaders } from "../helpers/auth-http";
import { requireMembership } from "../../modules/business/organization-membership";
import { PUBLIC_ROUTE } from "./public-route.decorator";

/** Path parameters that name the business a request is about. */
const ORGANIZATION_PARAMS = ["organizationId", "org"] as const;

/**
 * Default-deny authentication for the tenant surface.
 *
 * Auth used to be imperative: each handler called `authorize` or
 * `authorizeOrganization`, and a route that forgot shipped open. That is why the
 * invoice offer endpoint sat unauthenticated next to a guarded controller.
 *
 * This guard closes the structural hole instead of the individual ones. Any
 * route naming the business it acts on must carry a valid session belonging to
 * a member of that business, and it must be marked `@Public()` to opt out. The
 * per-handler role check is deliberately left where it is: this proves *who* the
 * caller is, `authorizeWrite` decides *what* they may change.
 *
 * Routes with no organization parameter are untouched. They are sign-in, webhooks
 * and shared-link surfaces, each of which authenticates by its own means.
 */
@Injectable()
export class OrgContextGuard implements CanActivate {
  constructor(
    @Inject(BETTER_AUTH) private readonly auth: BetterAuthInstance,
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true;
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;

    const request = context.switchToHttp().getRequest<Request>();
    const organizationId = this.organizationIdFrom(request);
    // Not a tenant route. Sign-in and webhooks prove themselves elsewhere.
    if (!organizationId) return true;

    const session = await this.auth.api.getSession({ headers: extractHeaders(request) });
    // An HttpException, not a bare Error: the filter maps those to 500, which
    // would report a missing session as a server fault.
    if (!session?.user?.id) throw new UnauthorizedException("Authentication required");

    await requireMembership(this.db, organizationId, session.user.id);
    return true;
  }

  private organizationIdFrom(request: Request): string | undefined {
    const params = request.params as Record<string, string | undefined>;
    for (const name of ORGANIZATION_PARAMS) {
      const value = params[name];
      // A UUID, never a slug or an arbitrary string: anything looser would let
      // a route smuggle a non-identifier through the check it thought it had.
      if (value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))
        return value;
    }
    return undefined;
  }
}
