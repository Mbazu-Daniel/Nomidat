import { Link } from "@tanstack/react-router";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", to: "/", hash: "features" },
      { label: "Pricing", to: "/pricing" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Log in", to: "/login" },
      { label: "Sign up", to: "/register" },
    ],
  },
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                N
              </span>
              <span className="font-display font-semibold text-foreground">nomidat</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Commerce software for businesses that sell in-store, online, and on invoice.
            </p>
          </div>

          <div className="flex gap-16 text-sm">
            {columns.map((column) => (
              <div key={column.title}>
                <p className="font-medium text-foreground">{column.title}</p>
                <ul className="mt-3 space-y-2">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.to}
                        hash={"hash" in link ? link.hash : undefined}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Nomidat. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
