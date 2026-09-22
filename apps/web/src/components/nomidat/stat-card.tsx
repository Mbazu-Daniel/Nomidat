import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-[0_2px_12px_rgba(124,45,18,0.06)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon ? (
          <span className="flex size-8 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}
