import { DomainVerificationService } from "./domain-verification.service";
import { PublicStorefrontController } from "./public-storefront.controller";
import { StorefrontCartService } from "./storefront-cart.service";
import { StorefrontCatalogService } from "./storefront-catalog.service";
import { StorefrontCheckoutService } from "./storefront-checkout.service";
import { StorefrontDomainController } from "./storefront-domain.controller";
import { StorefrontRateLimitGuard } from "./storefront-rate-limit.guard";
import { StorefrontResolver } from "./storefront-resolver.service";
import { StorefrontSettingsController } from "./storefront-settings.controller";
import { StorefrontSettingsService } from "./storefront-settings.service";
import { Module } from "@nestjs/common";
import { BusinessModule } from "../business/business.module";
import { DbModule } from "../../common/db/db.module";
import { InventoryModule } from "../inventory/inventory.module";
import { MoneyModule } from "../money/money.module";
import { SalesModule } from "../sales/sales.module";

/**
 * The public shop. Depends on sales and inventory so a storefront order is
 * recorded exactly like a counter sale — there is only one path to selling.
 *
 * BusinessModule is imported for BusinessAuthService, which the seller-facing
 * domain and settings controllers need to check who is calling them.
 */
@Module({
  imports: [BusinessModule, DbModule, SalesModule, InventoryModule, MoneyModule],
  controllers: [
    PublicStorefrontController,
    StorefrontDomainController,
    StorefrontSettingsController,
  ],
  providers: [
    StorefrontResolver,
    DomainVerificationService,
    StorefrontRateLimitGuard,
    StorefrontCatalogService,
    StorefrontCartService,
    StorefrontCheckoutService,
    StorefrontSettingsService,
  ],
  exports: [StorefrontResolver, StorefrontCatalogService, StorefrontCartService],
})
export class StorefrontModule {}
