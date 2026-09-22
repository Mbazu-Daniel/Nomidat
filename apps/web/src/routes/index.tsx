import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardView } from "@/components/nomidat/dashboard-view";
import { getBusinessData, getBusinessSummary, getOrganizations, type BusinessSummary } from "@/data/nomidat";
import type { OrganizationOption } from "@/components/nomidat/organization-switcher";

export const Route = createFileRoute("/")({ component: DashboardPage });

function DashboardPage() {
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [sales, setSales] = useState<Awaited<ReturnType<typeof getBusinessData>>>([]);
  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof getBusinessData>>>([]);
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
    setSummary(null);
    setSales([]);
    setExpenses([]);
    void Promise.all([
      getBusinessSummary(organizationId),
      getBusinessData(organizationId, "sales"),
      getBusinessData(organizationId, "expenses"),
    ]).then(([nextSummary, nextSales, nextExpenses]) => {
      if (cancelled) return;
      setSummary(nextSummary);
      setSales(nextSales);
      setExpenses(nextExpenses);
    }).catch(() => {
      if (!cancelled) setError("Could not load your business overview.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [organizationId]);

  return <DashboardView organizations={organizations} organizationId={organizationId} onOrganizationChange={setOrganizationId} summary={summary} sales={sales} expenses={expenses} loading={loading} error={error} />;
}
