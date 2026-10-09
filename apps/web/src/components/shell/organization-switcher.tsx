import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { rememberActiveOrg } from "@/lib/active-org";
import { useOrgContext } from "./org-context";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function OrganizationSwitcher() {
  const { organization, organizations } = useOrgContext();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function switchTo(target: (typeof organizations)[number]) {
    setOpen(false);
    if (target.id === organization.id) return;
    rememberActiveOrg(target.id);
    if (target.slug) void navigate({ to: "/$orgSlug", params: { orgSlug: target.slug } });
    else void navigate({ to: "/create-organization" });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Switch business"
          className="flex w-full items-center gap-2.5 rounded-lg border border-[#e8ebef] bg-white px-3 py-2 text-left text-sm hover:bg-[#fff6f1]"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#fff0e8] text-xs font-bold text-[#d96530]">
            {initials(organization.name)}
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-[13px] font-semibold text-[#242b35]">
              {organization.name}
            </strong>
            <small className="block truncate text-[10px] text-[#8b939f]">Business workspace</small>
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 text-[#8b939f]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Search business…" />
          <CommandList>
            <CommandEmpty>No business found.</CommandEmpty>
            <CommandGroup heading="Businesses">
              {organizations.map((org) => (
                <CommandItem key={org.id} value={org.name} onSelect={() => switchTo(org)}>
                  <CheckIcon
                    className={cn(
                      "size-4",
                      org.id === organization.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {org.name}
                </CommandItem>
              ))}
              <CommandItem
                value="__create_business__"
                onSelect={() => {
                  setOpen(false);
                  void navigate({ to: "/create-organization" });
                }}
              >
                <PlusIcon className="size-4" />
                Create business
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
