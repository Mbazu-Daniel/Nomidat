import { useEffect, useState } from "react";
import { createApiRequest } from "@/lib/api";

export function BusinessHandle({ value }: { value: string }) {
  const [status, setStatus] = useState("");
  useEffect(() => {
    let cancelled = false;
    setStatus("");
    if (!/^[a-z0-9-]+$/.test(value)) return;
    const timer = setTimeout(() => {
      setStatus("Checking availability…");
      void createApiRequest<{ status: boolean }>("/organizations/check-slug", {
        method: "POST",
        body: JSON.stringify({ slug: value }),
      })
        .then((result) => {
          if (!cancelled)
            setStatus(
              result.status ? "This handle is available." : "This handle is already taken.",
            );
        })
        .catch((reason: Error) => {
          if (!cancelled)
            setStatus(
              /taken|exist|unavailable/i.test(reason.message)
                ? "This handle is already taken."
                : "Could not check availability. It will be checked when you save.",
            );
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);
  return <small role="status">{status}</small>;
}
