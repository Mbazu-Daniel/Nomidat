import { BarChart3, Package, Receipt, ShoppingBag, Store, Users } from "lucide-react";
import { LandingSection, SectionHeading } from "./landing-section";

const features = [
  {
    icon: Store,
    title: "POS",
    description: "Fast checkout for walk-in customers. Cash, transfer, or card.",
  },
  {
    icon: ShoppingBag,
    title: "Storefront",
    description: "A clean online shop linked to the same products and stock.",
  },
  {
    icon: Receipt,
    title: "Invoicing",
    description: "Send quotes, collect payment online, and track what is owed.",
  },
  {
    icon: Package,
    title: "Inventory",
    description: "Stock updates automatically when you sell - online or in-store.",
  },
  {
    icon: Users,
    title: "Customers",
    description: "Keep contact details and purchase history in one place.",
  },
  {
    icon: BarChart3,
    title: "Insights",
    description: "See revenue and order trends without exporting spreadsheets.",
  },
];

export function FeaturesSection() {
  return (
    <LandingSection id="features" tone="muted">
      <SectionHeading
        eyebrow="Product"
        title="Everything you need to sell and manage"
        body="Built for retailers and growing brands who want software that stays out of the way."
        className="flex flex-wrap items-end justify-between gap-6"
      />

      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary-soft">
              <feature.icon className="size-5 text-primary" />
            </div>
            <h3 className="mt-4 font-semibold text-foreground">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </LandingSection>
  );
}
