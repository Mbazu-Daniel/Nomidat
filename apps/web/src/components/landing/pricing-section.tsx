import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

interface Plan {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted: boolean;
}

const plans: Plan[] = [
  {
    name: "Starter",
    price: "\u20a629,000",
    description: "For solo sellers and small shops getting online.",
    features: [
      "Online storefront",
      "POS lite",
      "Inventory tracking",
      "Invoice creation",
      "No fees on POS or checkout",
    ],
    cta: "Start free trial",
    href: "/register",
    highlighted: false,
  },
  {
    name: "Business",
    price: "\u20a679,000",
    description: "For growing brands with more volume and locations.",
    features: [
      "Everything in Starter",
      "Offline POS",
      "Advanced inventory",
      "Priority support",
      "Analytics dashboard",
    ],
    cta: "Start free trial",
    href: "/register",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "Dedicated setup for larger teams and custom needs.",
    features: [
      "Dedicated infrastructure",
      "API & webhooks",
      "Custom SLAs",
      "Volume pricing",
      "Dedicated support",
    ],
    cta: "Contact sales",
    href: "mailto:hello@nomidat.com",
    highlighted: false,
  },
];

const faqs = [
  {
    q: "Do you charge on every sale?",
    a: "No. Your monthly plan covers POS and storefront checkout. We only apply a small platform fee when a customer pays an invoice online through Nomidat.",
  },
  {
    q: "What about payment processor fees?",
    a: "Standard Paystack or bank processing fees still apply - the same as if you integrated payments directly. Nomidat does not add extra fees on top for in-store or storefront sales.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes. Upgrade or downgrade as your business grows. Enterprise plans are tailored to your volume and requirements.",
  },
];

interface PricingSectionProps {
  showHeader?: boolean;
  className?: string;
}

export function PricingSection({ showHeader = true, className }: PricingSectionProps) {
  return (
    <section className={cn("py-16 md:py-20", className)}>
      <div className="mx-auto w-full max-w-6xl px-6">
        {showHeader && (
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Simple, honest pricing
            </h1>
            <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
              One flat subscription for your tools. No surprise take-rates on every order — invoice
              payments are the only place we charge a transaction fee.
            </p>
          </div>
        )}

        <div className="mt-12 rounded-xl border border-success/20 bg-success-soft px-5 py-4 text-center text-sm text-foreground">
          <span className="font-medium text-success-dark">Included in every plan:</span> zero
          Nomidat fees on POS and storefront checkout.{" "}
          <span className="font-medium">Invoice online payments:</span> 2.5% platform fee (plus
          standard processor fees).
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-6 md:p-8",
                plan.highlighted
                  ? "border-primary shadow-sm ring-1 ring-primary/20"
                  : "border-border",
              )}
            >
              {plan.highlighted && (
                <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-primary">
                  Most popular
                </p>
              )}
              <h2 className="text-lg font-semibold text-foreground">{plan.name}</h2>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-display text-3xl font-semibold tracking-tight text-foreground">
                  {plan.price}
                </span>
                {plan.price !== "Custom" && (
                  <span className="text-sm text-muted-foreground">/month</span>
                )}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {plan.description}
              </p>

              <ul className="mt-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    <span className="text-foreground/90">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className="mt-8 h-11 w-full"
                variant={plan.highlighted ? "default" : "outline"}
              >
                {plan.href.startsWith("mailto:") ? (
                  <a href={plan.href}>{plan.cta}</a>
                ) : (
                  <Link to={plan.href as "/register"}>{plan.cta}</Link>
                )}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-16 max-w-3xl">
          <h2 className="text-xl font-semibold text-foreground">Common questions</h2>
          <div className="mt-6 space-y-6">
            {faqs.map((item) => (
              <div key={item.q}>
                <h3 className="text-sm font-medium text-foreground">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
