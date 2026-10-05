import { PayoutAccountController } from "./payout-account.controller";
import { WalletController } from "./wallet.controller";
import { PayoutAccountService } from "./payout-account.service";
import { Module } from "@nestjs/common";
import { BusinessModule } from "../business/business.module";
import { DbModule } from "../../common/db/db.module";
import { EnvModule } from "../../common/config/env.module";
import { PaystackPlatformClient } from "./paystack-platform.client";
import { WalletRepository } from "./wallet.repository";
import { WalletService } from "./wallet.service";

/**
 * Where tenant money goes. The platform holds the merchant relationship, so this
 * module is the only place that talks to Paystack with a platform credential.
 */
@Module({
  imports: [BusinessModule, DbModule, EnvModule],
  controllers: [PayoutAccountController, WalletController],
  providers: [PaystackPlatformClient, PayoutAccountService, WalletRepository, WalletService],
  exports: [PaystackPlatformClient, PayoutAccountService, WalletRepository, WalletService],
})
export class PayoutsModule {}
