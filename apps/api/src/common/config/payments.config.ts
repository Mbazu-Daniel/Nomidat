import { z } from "zod";

/** One account for the whole platform; tenants never hold their own key. */
export const PLATFORM_PAYSTACK_SECRET = z.string().min(1).optional();
export const PLATFORM_PAYSTACK_PUBLIC = z.string().optional();

/** Default platform cut, in basis points, before a tenant has a negotiated rate. */
export const PLATFORM_DEFAULT_FEE_BPS = z.coerce.number().int().min(0).max(10_000).default(0);
