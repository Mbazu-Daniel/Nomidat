import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Shared section chrome. Every landing section used to invent its own padding
 * and container width, which is why the page had no consistent rhythm.
 */
export function LandingSection({
  id,
  tone = "base",
  className,
  children,
}: {
  id?: string;
  tone?: "base" | "muted";
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "py-20 md:py-28",
        tone === "muted" && "border-y border-border/60 bg-muted/40",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl px-6">{children}</div>
    </section>
  );
}

/** Eyebrow, heading and lede, in the order a reader scans them. */
export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "start",
  className,
}: {
  eyebrow: string;
  title: string;
  body: string;
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        <span className="size-1.5 rounded-full bg-primary" />
        {eyebrow}
      </p>
      <h2 className="mt-3 text-balance font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
        {body}
      </p>
    </div>
  );
}
