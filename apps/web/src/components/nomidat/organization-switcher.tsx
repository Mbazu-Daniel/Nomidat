import { IconBuildingStore, IconChevronDown, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export type OrganizationOption = { id: string; name: string };

export function OrganizationSwitcher({
  organizations,
  currentOrganizationId,
  onChange,
}: {
  organizations: OrganizationOption[];
  currentOrganizationId?: string;
  onChange?: (organizationId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current =
    organizations.find((organization) => organization.id === currentOrganizationId) ??
    organizations[0];

  if (!current) {
    return (
      <Button variant="outline" size="sm" className="rounded-full">
        <IconBuildingStore data-icon="inline-start" />
        Create business
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-10 max-w-[190px] rounded-full border-orange-200 bg-white px-3 shadow-sm hover:bg-orange-50"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
            <IconBuildingStore className="size-4" />
          </span>
          <span className="truncate text-left">{current.name}</span>
        </span>
        <IconChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </Button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-orange-100 bg-white p-2 shadow-xl">
          <p className="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Your businesses
          </p>
          <div className="flex flex-col gap-1">
            {organizations.map((organization) => (
              <button
                key={organization.id}
                type="button"
                className="flex items-center rounded-xl px-3 py-2.5 text-left text-sm hover:bg-orange-50"
                onClick={() => {
                  onChange?.(organization.id);
                  setOpen(false);
                }}
              >
                <span className="min-w-0 flex-1 truncate">{organization.name}</span>
                {organization.id === current.id ? (
                  <span className="ml-2 size-2 rounded-full bg-orange-500" />
                ) : null}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-1 flex w-full items-center gap-2 rounded-xl border-t border-border px-3 py-3 text-sm font-medium text-orange-700 hover:bg-orange-50"
          >
            <IconPlus className="size-4" />
            Add business
          </button>
        </div>
      ) : null}
    </div>
  );
}
