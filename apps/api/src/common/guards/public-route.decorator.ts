import { SetMetadata, type CustomDecorator } from "@nestjs/common";

export const PUBLIC_ROUTE = "nomidat:public-route";

/**
 * Marks a route as reachable without a session.
 *
 * The guard is default-deny: a route is closed unless it says otherwise here.
 * This inverts the previous arrangement, where every handler had to remember to
 * call `authorize` and a route that simply forgot shipped open.
 *
 * Two categories qualify, and only these two:
 *
 * - Sign-in and webhooks. A caller with no session by definition, authenticated
 *   by a provider signature or a shared secret instead.
 * - Deliberately public surfaces: a storefront, and an invoice behind a share
 *   code. Both are reached from a link in a message by someone who has no
 *   account here.
 */
export const Public = (): CustomDecorator => SetMetadata(PUBLIC_ROUTE, true);
