import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ThemeToggle } from "../theme/theme-toggle";

const navLinks = [
  { label: "Features", to: "/", hash: "features" },
  { label: "Pricing", to: "/pricing" },
] as const;

export function LandingNavbar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors",
        scrolled ? "border-border bg-background/85 backdrop-blur-md" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            N
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-foreground">
            nomidat
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              hash={"hash" in item ? item.hash : undefined}
              className={cn(
                "text-sm text-muted-foreground transition-colors hover:text-foreground",
                pathname === item.to && "font-medium text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="hidden px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Log in
          </Link>
          <ThemeToggle className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground" />
          <Button asChild size="sm">
            <Link to="/register">Start free trial</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
