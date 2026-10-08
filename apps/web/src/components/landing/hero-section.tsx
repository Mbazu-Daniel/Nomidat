import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Play } from "lucide-react";
import { ProductPreview } from "./product-preview";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_45%_at_50%_0%,var(--primary-soft),transparent_70%)] dark:bg-[radial-gradient(60%_45%_at_50%_0%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_70%)]"
      />

      <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-20 md:pb-20 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance font-display text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Run your whole business
            <span className="block text-muted-foreground">from one calm workspace</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            Sell in-store, online, and on invoice. Stock, payments, and records stay in sync — even
            when the network drops mid-sale.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-full px-7">
              <Link to="/register">
                Start free trial
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 rounded-full bg-card px-7">
              <Link to="/pricing">
                <Play className="size-4" />
                See a demo
              </Link>
            </Button>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            No transaction fees on POS or storefront checkout.
          </p>
        </div>

        <div className="mt-16 md:mt-20">
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}
