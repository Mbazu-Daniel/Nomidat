import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { LandingSection } from "./landing-section";

export function CtaSection() {
  return (
    <LandingSection>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Ready to simplify how you sell?
        </h2>
        <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
          Set up in minutes. Your subscription covers POS and storefront — you only pay a small fee
          when customers pay invoices online.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 px-7">
            <Link to="/register">
              Get started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 px-7">
            <Link to="/pricing">Compare plans</Link>
          </Button>
        </div>
      </div>
    </LandingSection>
  );
}
