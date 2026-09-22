import type { ReactNode } from "react";

export function ActivityRow({
  icon,
  title,
  description,
  amount,
  status,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  amount?: string;
  status?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      {amount ? <span className="text-sm font-semibold">{amount}</span> : null}
      {status ? (
        <span className="rounded-full bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-700">
          {status}
        </span>
      ) : null}
    </div>
  );
}
