import { canWriteArea } from "./staff-permissions";
import { SettingsNavigation } from "./settings-navigation";
import { AccountPanel } from "./account-panel";
import { BusinessProfileEditor } from "./business-profile-editor";
import { ExpenseCategories } from "./expense-categories";
import { BusinessAccessActions } from "./business-access-actions";
import { PaymentVerification } from "./payment-verification";
import { useEffect, useState } from "react";
import { StaffPanel } from "./staff-panel";
import { createApiRequest } from "@/lib/api";

export function SettingsPanel({ organizationId }: { organizationId: string }) {
  const [section, setSection] = useState(organizationId ? "profile" : "account");
  const [role, setRole] = useState("");
  const canManage = role.split(",").some((value) => ["owner", "admin"].includes(value));
  const canWrite = canWriteArea(role, "sales");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const path = `/organizations/${organizationId}/business-profile`;
  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    void createApiRequest<{ role: string }>(`/organizations/${organizationId}/access`)
      .then((data) => {
        if (!cancelled) setRole(data.role);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    void createApiRequest<{ paystackConnected: boolean }>(path)
      .then((result) => {
        if (!cancelled) setConnected(result.paystackConnected);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, path]);
  function renderPaymentSettings() {
    if (!canManage) return null;
    return (
      <form
        className="workspace-card workspace-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const secretKey = new FormData(form).get("key");
          setBusy(true);
          setError("");
          setSaved(false);
          try {
            await createApiRequest(path + "/payment-key", {
              method: "PUT",
              body: JSON.stringify({ secretKey }),
            });
            setConnected(true);
            setSaved(true);
            form.reset();
          } catch (reason) {
            setError((reason as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>
          Paystack{" "}
          <span className="workspace-badge">{connected ? "Connected" : "Not connected"}</span>
        </h2>
        <p className="workspace-readonly">
          Only a business owner or admin can update these credentials.
        </p>
        <label>
          Secret key
          <input
            type="password"
            name="key"
            autoComplete="off"
            required
            pattern="sk_(test|live)_[A-Za-z0-9]+"
            placeholder="sk_test_…"
            maxLength={200}
          />
          <small>Your key is encrypted and never shown again.</small>
        </label>
        {error && (
          <p role="alert" className="workspace-error">
            {error}
          </p>
        )}
        {saved && <p role="status">Paystack key saved.</p>}
        <div className="workspace-actions">
          <button className="workspace-primary" disabled={busy}>
            {busy ? "Saving…" : "Save payment settings"}
          </button>
        </div>
      </form>
    );
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
        disabled={busy}
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
      {section === "profile" && organizationId && (
        <BusinessProfileEditor
          key={`profile-${organizationId}`}
          organizationId={organizationId}
          canManage={canManage}
        />
      )}
      {section === "staff" && organizationId && (
        <StaffPanel key={organizationId} organizationId={organizationId} />
      )}
      {section === "categories" && organizationId && (
        <ExpenseCategories
          organizationId={organizationId}
          canWrite={canWriteArea(role, "expenses")}
        />
      )}
      {section === "payments" && renderPaymentSettings()}
      {section === "verification" && canWrite && (
        <PaymentVerification organizationId={organizationId} />
      )}
      {section === "access" && role && (
        <BusinessAccessActions
          organizationId={organizationId}
          owner={role.split(",").includes("owner")}
        />
      )}
      {section === "account" && <AccountPanel />}
    </>
  );
}
