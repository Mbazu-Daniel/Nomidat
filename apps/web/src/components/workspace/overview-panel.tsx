import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  IconArrowUpRight,
  IconPackage,
  IconReceipt,
  IconWallet,
  IconSparkles,
} from "@tabler/icons-react";
import { formatNaira, getBusinessSummary, type BusinessSummary } from "@/data/nomidat";

export function OverviewPanel({ organizationId }: { organizationId: string }) {
  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void getBusinessSummary(organizationId)
      .then((result) => {
        if (!cancelled) setSummary(result);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);
  return (
    <>
      <div className="workspace-heading">
        <div>
          <h1>Your business, at a glance</h1>
          <p>Keep an eye on what’s selling, what’s owed and what needs a restock.</p>
        </div>
        <Link to="/sales" className="workspace-primary">
          Record a sale <IconArrowUpRight size={18} />
        </Link>
      </div>
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
      <div className="workspace-stats">
        {[
          {
            label: "Recorded sales",
            value: summary ? formatNaira(summary.salesTotalKobo / 100) : "—",
            detail: "All recorded sales",
            icon: IconReceipt,
          },
          {
            label: "Outstanding credit",
            value: summary ? formatNaira(summary.outstandingCreditKobo / 100) : "—",
            detail: "Still to be collected",
            icon: IconArrowUpRight,
          },
          {
            label: "Business expenses",
            value: summary ? formatNaira(summary.expensesTotalKobo / 100) : "—",
            detail: "All recorded spending",
            icon: IconWallet,
          },
          {
            label: "Products in inventory",
            value: summary?.productCount ?? "—",
            detail: `${summary?.lowStockCount ?? "—"} need a restock`,
            icon: IconPackage,
          },
        ].map((stat) => (
          <article className="workspace-stat" key={stat.label}>
            <div>
              <span>{stat.label}</span>
              <stat.icon size={19} />
            </div>
            <strong>{stat.value}</strong>
            <p>{stat.detail}</p>
          </article>
        ))}
      </div>
      <div className="workspace-overview-grid">
        <section className="workspace-assistant-card">
          <span className="workspace-icon">
            <IconSparkles size={24} />
          </span>
          <p className="workspace-eyebrow">LESS ADMIN. MORE BUSINESS.</p>
          <h2>Just say what happened.</h2>
          <p>
            Ask about stock, record an expense, or turn a conversation into a sale. Nomidat helps
            with the details.
          </p>
          <blockquote>“I sold 5 bags of cement to Chinedu for ₦42,500 on credit.”</blockquote>
          <Link to="/chat" className="workspace-primary">
            Start a conversation <IconArrowUpRight size={18} />
          </Link>
        </section>
        <section className="workspace-card workspace-get-started">
          <p className="workspace-eyebrow">YOUR DAILY TOOLKIT</p>
          <h2>What would you like to do?</h2>
          {[
            ["/inventory", "Check your inventory", "Add products and update stock levels"],
            ["/customers", "Get to know your customers", "Contacts, notes and purchase history"],
            ["/invoices", "Put it in writing", "Create an invoice for your next sale"],
            ["/channels", "Take your business with you", "Connect Telegram or WhatsApp"],
          ].map(([to, title, description]) => (
            <Link to={to} key={to}>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <IconArrowUpRight size={18} />
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
