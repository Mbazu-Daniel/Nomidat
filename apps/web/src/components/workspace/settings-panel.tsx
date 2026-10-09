import { canWriteArea } from "./staff-permissions";
import { SettingsNavigation } from "./settings-navigation";
import { AccountPanel } from "./account-panel";
import { OrganizationProfileEditor } from "./organization-profile-editor";
import { ExpenseCategories } from "./expense-categories";
import { OrganizationAccessActions } from "./organization-access-actions";
import { PaymentVerification } from "./payment-verification";
import { useState } from "react";
import { useApiResource } from "@/lib/use-api-resource";
import { StaffPanel } from "./staff-panel";
import { WalletPanel } from "./wallet-panel";
import { AuditLogPanel } from "./audit-log-panel";
import { InboxPanel } from "./inbox-panel";
import { WebhooksPanel } from "./webhooks-panel";
import "./engagement.css";

export function SettingsPanel({ organizationId }: { organizationId: string }) {
  const [section, setSection] = useState(organizationId ? "profile" : "account");
  const access = useApiResource<{ role: string }>(
    organizationId ? `/organizations/${organizationId}/access` : null,
    { role: "" },
  );
  const role = access.data.role;
  const canManage = role.split(",").some((value) => ["owner", "admin"].includes(value));
  const canWrite = canWriteArea(role, "sales");
  const error = access.error;
  function renderPaymentSettings() {
    if (!canManage) return null;
    // No key form on purpose. Payments run on the platform's own Paystack
    // account and tenants are paid out from the platform wallet, so there is no
    // per-tenant secret to collect. The old form accepted a key that nothing
    // read and then reported "Connected".
    return (
      <section className="workspace-card">
        <h2>Payments</h2>
        <p className="workspace-readonly">
          Card payments are processed on the Nomidat platform account. Payouts are sent to the
          payout account you registered, and you can track them in Wallet.
        </p>
        <div className="workspace-actions">
          <a className="workspace-primary" href="#wallet">
            Go to Wallet
          </a>
        </div>
      </section>
    );
  }
  function renderSection() {
    if (section === "account") return <AccountPanel />;
    if (section === "wallet") return <WalletPanel organizationId={organizationId} />;
    if (!organizationId) return null;
    switch (section) {
      case "profile":
        return (
          <OrganizationProfileEditor
            key={`profile-${organizationId}`}
            organizationId={organizationId}
            canManage={canManage}
          />
        );
      case "staff":
        return <StaffPanel key={organizationId} organizationId={organizationId} />;
      case "categories":
        return (
          <ExpenseCategories
            organizationId={organizationId}
            canWrite={canWriteArea(role, "expenses")}
          />
        );
      case "payments":
        return renderPaymentSettings();
      case "verification":
        return canWrite && <PaymentVerification organizationId={organizationId} />;
      case "access":
        return (
          role && (
            <OrganizationAccessActions
              organizationId={organizationId}
              owner={role.split(",").includes("owner")}
            />
          )
        );
      case "inbox":
        return <InboxPanel key={organizationId} organizationId={organizationId} />;
      case "activity":
        return <AuditLogPanel key={organizationId} organizationId={organizationId} />;
      case "webhooks":
        return <WebhooksPanel key={organizationId} organizationId={organizationId} />;
      default:
        return null;
    }
  }
  return (
    <>
      <div className="workspace-heading">
        <div>
          <h1>Settings</h1>
          <p>Choose a section to manage your business and account.</p>
        </div>
      </div>
      <SettingsNavigation
        value={section}
        onChange={setSection}
        hasBusiness={Boolean(organizationId)}
        canManage={canManage}
        canWrite={canWrite}
        hasAccess={Boolean(role)}
      />
      {error && section !== "payments" && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {renderSection()}
    </>
  );
}
