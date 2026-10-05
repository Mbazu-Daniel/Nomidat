import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StorefrontCartService } from "./storefront-cart.service";
import { StorefrontCatalogService } from "./storefront-catalog.service";
import { StorefrontCheckoutService } from "./storefront-checkout.service";
import { StorefrontResolver } from "./storefront-resolver.service";
import { StorefrontCheckoutDto, AddToCartLineDto } from "./dto/storefront-checkout.dto";
import { StorefrontRateLimitGuard } from "./storefront-rate-limit.guard";

/**
 * The shopper-facing API. Deliberately unauthenticated: a shopper has no
 * account. The Host header is how `shop.example.com` finds its own storefront,
 * which is what makes per-shop subdomains work without any edge rewrite.
 */
@ApiTags("Public Storefront")
@UseGuards(StorefrontRateLimitGuard)
@Controller("public/storefront")
export class PublicStorefrontController {
  constructor(
    private readonly resolver: StorefrontResolver,
    private readonly catalog: StorefrontCatalogService,
    private readonly carts: StorefrontCartService,
    private readonly checkout: StorefrontCheckoutService,
  ) {}

  @Get("resolve")
  @ApiOperation({ summary: "Find the shop that owns this hostname" })
  async resolveHost(
    @Headers("x-storefront-host") forwardedHost: string | undefined,
    @Headers("host") host: string | undefined,
  ) {
    // The browser's own Host, or the shopper's hostname forwarded by the client
    // when the API is served from a different origin.
    const result = await this.resolver.resolveHost(forwardedHost || host || "");
    if (!result) return { resolved: false };

    // Only a published shop is handed to the browser.
    if (!result.published) return { resolved: false };
    return {
      resolved: true,
      organizationId: result.organizationId,
      slug: result.slug,
      template: result.template,
    };
  }

  @Get(":slug/config")
  @ApiOperation({ summary: "Theme, SEO and checkout settings for a shop" })
  getConfig(@Param("slug") slug: string) {
    return this.resolver.getPublicConfig(slug);
  }

  @Get(":slug/categories")
  getCategories(@Param("slug") slug: string) {
    return this.catalog.getCategories(slug);
  }

  @Get(":slug/products")
  @ApiOperation({ summary: "Published products" })
  getProducts(
    @Param("slug") slug: string,
    @Query("search") search?: string,
    @Query("categoryId") categoryId?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.catalog.getProducts(slug, {
      search,
      categoryId,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(":slug/products/:productId")
  getProduct(@Param("slug") slug: string, @Param("productId") productId: string) {
    return this.catalog.getProduct(slug, productId);
  }

  @Post(":slug/cart")
  @ApiOperation({ summary: "Open a basket or add a line to it" })
  async addToCart(@Param("slug") slug: string, @Body() body: AddToCartLineDto) {
    const config = await this.resolver.getPublicConfig(slug);
    if (!body.cartToken) {
      return this.carts.openCart(config.organizationId);
    }
    return this.carts.addItem(config.organizationId, body.cartToken, {
      productId: body.productId,
      // Dropping this would price the basket line at the parent rate and draw
      // down the variant-less Stock Level.
      variantId: body.variantId,
      quantity: body.quantity,
    });
  }

  @Get(":slug/cart/:cartToken")
  getCart(@Param("slug") slug: string, @Param("cartToken") cartToken: string) {
    return this.resolver
      .getPublicConfig(slug)
      .then((config) => this.carts.getCartByToken(config.organizationId, cartToken));
  }

  @Post(":slug/checkout")
  @ApiOperation({ summary: "Turn a basket into an order" })
  placeOrder(@Param("slug") slug: string, @Body() body: StorefrontCheckoutDto) {
    return this.checkout.checkout(slug, body);
  }
}
