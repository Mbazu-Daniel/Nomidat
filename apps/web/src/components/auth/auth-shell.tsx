import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@tanstack/react-router";
import { IconCheck } from "@tabler/icons-react";
import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

/**
 * The frame shared by sign-in, sign-up and onboarding: a white form panel beside
 * a brand showcase panel, inside one rounded card.
 *
 * Tailwind utilities throughout rather than a hand-written stylesheet. The
 * showcase is tinted from `--primary`, so it stays the rose-gold brand instead
 * of carrying a second colour scheme — see design.md, "one accent".
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  showcase,
  brand = "nomidat",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Right-hand panel. Login and sign-up pass the same pitch copy. */
  showcase?: { headline: string; body: string; points: string[] };
  brand?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-8">
      <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-2xl border bg-card shadow-sm md:grid-cols-2">
        <section className="p-10 max-md:p-8">
          <div className="flex h-full flex-col gap-7">
            <Link
              to="/"
              className="inline-flex w-fit items-center gap-2 font-semibold text-foreground"
              aria-label={`${brand} home`}
            >
              <span className="text-primary" aria-hidden="true">
                <BrandMark />
              </span>
              <span>{brand}</span>
            </Link>

            <header className="flex flex-col gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </header>

            {children}
            {footer}
          </div>
        </section>

        {showcase && (
          <aside
            aria-hidden="true"
            className="hidden flex-col justify-center gap-6 bg-primary p-12 text-primary-foreground md:flex"
          >
            <div>
              <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight">
                {showcase.headline}
              </h2>
              <p className="mt-3 text-sm text-primary-foreground/80">{showcase.body}</p>
            </div>
            <ul className="flex flex-col gap-3 text-sm">
              {showcase.points.map((point) => (
                <li key={point} className="flex items-center gap-2.5">
                  <IconCheck size={16} className="shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </main>
  );
}

function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
      <path
        d="M12 2.5 14.6 9.4 21.5 12l-6.9 2.6L12 21.5 9.4 14.6 2.5 12l6.9-2.6L12 2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** The "or continue with" rule between the form and the social buttons. */
export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs tracking-wider text-muted-foreground uppercase">
      <span className="h-px flex-1 bg-border" />
      {children}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** A row of pick-one options, used for business type, size and theme. */
export function AuthChoiceGroup({
  legend,
  options,
  value,
  onChange,
  showHint = true,
}: {
  legend: string;
  options: readonly { value: string; label: string; hint?: string }[];
  value: string;
  onChange: (value: string) => void;
  showHint?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-foreground">{legend}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            // aria-pressed rather than role=radio: these are independent
            // toggles, and a fake radio group breaks arrow-key expectations.
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className="flex flex-col gap-0.5 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-primary/60 aria-pressed:border-primary aria-pressed:bg-primary/5"
          >
            <strong className="text-sm font-semibold text-foreground">{option.label}</strong>
            {showHint && option.hint && (
              <small className="text-xs text-muted-foreground">{option.hint}</small>
            )}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function AuthField({
  label,
  hint,
  error,
  ...inputProps
}: React.ComponentProps<typeof Input> & { label: string; hint?: string; error?: string }) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Password entry with a reveal toggle, so typos are caught before submitting. */
export function PasswordField(props: React.ComponentProps<typeof AuthField>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <AuthField {...props} type={visible ? "text" : "password"} className="pr-10" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((current) => !current)}
        className="absolute right-1 top-8 text-muted-foreground"
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}
