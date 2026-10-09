import { CtaSection } from "@/components/landing/cta-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { TrustStrip } from "@/components/landing/trust-strip";
import { resolveActiveOrg } from "@/lib/active-org";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { signedIn, slug } = await resolveActiveOrg();
    if (slug) throw redirect({ to: "/$orgSlug", params: { orgSlug: slug } });
    if (signedIn) throw redirect({ to: "/create-organization" });
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-landing-sans text-foreground">
      <LandingNavbar />
      <main className="flex-1">
        <HeroSection />
        <TrustStrip />
        <FeaturesSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
