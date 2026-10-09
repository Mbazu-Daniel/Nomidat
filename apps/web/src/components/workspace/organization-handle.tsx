import { useEffect, useState } from "react";
import { checkOrganizationHandle } from "@/data/nomidat";

/** How long to wait after the last keystroke before asking the API. */
const SETTLE_MS = 400;

/**
 * Says whether a business handle is free, without shouting at the seller.
 *
 * Debounced, because a handle is typed a character at a time and an undebounced
 * check would ask about every prefix. The message a refusal produces is
 * deliberately softer than the error: failing to check must not stop the seller
 * saving, and saying so is better than a red sentence they cannot act on.
 */
export function OrganizationHandle({ value }: { value: string }) {
  const [status, setStatus] = useState("");

  useEffect(() => {
    setStatus("");
    if (!/^[a-z0-9-]+$/.test(value)) return;

    const timer = setTimeout(() => {
      setStatus("Checking availability…");
      void checkOrganizationHandle(value)
        .then((free) => {
          setStatus(free ? "This handle is available." : "This handle is already taken.");
        })
        .catch((reason: Error) => {
          setStatus(
            /taken|exist|unavailable/i.test(reason.message)
              ? "This handle is already taken."
              : "Could not check availability. It will be checked when you save.",
          );
        });
    }, SETTLE_MS);

    // Clearing the timer is the whole of the cancellation: nothing is in flight
    // until the debounce has elapsed, so there is no stale answer to discard.
    return () => clearTimeout(timer);
  }, [value]);

  return <small role="status">{status}</small>;
}
