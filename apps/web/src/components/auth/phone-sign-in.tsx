import { useState } from "react";
import { createApiRequest } from "@/lib/api";
export function PhoneSignIn() {
  const [phoneNumber, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendAt, setResendAt] = useState(0);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          if (!sent) {
            if (Date.now() < resendAt)
              throw new Error("Please wait a minute before requesting another code.");
            await createApiRequest("/auth/phone-number/send-otp", {
              method: "POST",
              body: JSON.stringify({ phoneNumber }),
            });
            setSent(true);
            setResendAt(Date.now() + 60000);
          } else {
            await createApiRequest("/auth/phone-number/verify", {
              method: "POST",
              body: JSON.stringify({ phoneNumber, code }),
            });
            sessionStorage.removeItem("nomidat.organization");
            window.location.assign("/settings");
          }
        } catch (reason) {
          setError((reason as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-semibold">Sign in with your phone</h2>
      <p className="text-sm text-muted-foreground">
        Invited by your business? Verify your number, then accept your invitation in Settings.
      </p>
      <label className="flex flex-col gap-2 text-sm">
        Phone number
        <input
          className="rounded-lg border p-3"
          type="tel"
          autoComplete="tel"
          placeholder="+2348012345678"
          pattern="\+[1-9][0-9]{7,14}"
          required
          value={phoneNumber}
          disabled={busy || sent}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
      {sent && (
        <label className="flex flex-col gap-2 text-sm">
          Verification code
          <input
            className="rounded-lg border p-3"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <button className="rounded-lg bg-orange-500 p-3 font-semibold text-white" disabled={busy}>
        {busy ? "Please wait…" : sent ? "Verify & sign in" : "Send verification code"}
      </button>
      {sent && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setSent(false);
            setCode("");
          }}
        >
          Change number or request a new code
        </button>
      )}
    </form>
  );
}
