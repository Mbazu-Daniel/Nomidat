import { useEffect, useState } from "react";
import { OrganizationSwitcher, type OrganizationOption } from "@/components/nomidat/organization-switcher";
import { formatNaira, getBusinessData, getOrganizations } from "@/data/nomidat";
import { BusinessListView } from "./business-list-view";

type Section = "sales" | "customers" | "inventory" | "expenses";

export function BusinessListPage({ section }: { section: Section }) {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getBusinessData>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getOrganizations().then((result) => {
      if (cancelled) return;
      const options = result.map((organization) => ({ id: organization.id, name: organization.name }));
      setOrganizations(options);
      setOrganizationId((current) => current || options[0]?.id || "");
      if (options.length === 0) setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setError("Could not load your businesses.");
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRows([]);
    void getBusinessData(organizationId, section).then((result) => {
      if (!cancelled) setRows(result);
    }).catch(() => {
      if (!cancelled) {
        setRows([]);
        setError("Could not load this business data.");
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [organizationId, section]);

  return (
    <BusinessListView
      section={section}
      organizations={organizations}
      organizationId={organizationId}
      onOrganizationChange={setOrganizationId}
      rows={rows}
      loading={loading}
      error={error}
    />
  );
}
