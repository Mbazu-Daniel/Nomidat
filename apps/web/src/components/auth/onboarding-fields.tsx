import { IconPhotoPlus, IconBuildingStore } from "@tabler/icons-react";
import { readBusinessLogo } from "@/components/workspace/business-logo";
import { useState } from "react";

/**
 * The image picker for a business logo or a member avatar.
 *
 * The file is downscaled to a data URL in the browser rather than uploaded, so
 * the whole value round-trips as a string and there is no second storage
 * boundary to secure.
 *
 * `ChoiceGroup` lives in auth-shell rather than here: both are the same pick-one
 * control and two copies would drift.
 */
export { AuthChoiceGroup as ChoiceGroup } from "./auth-shell";

export function ImagePicker({
  value,
  onChange,
  label,
  hint,
  fallback,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  label: string;
  hint: string;
  fallback: "building" | "person";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted text-muted-foreground">
        {value ? (
          <img src={value} alt="Preview" className="size-full object-cover" />
        ) : fallback === "building" ? (
          <IconBuildingStore size={28} />
        ) : (
          <IconPhotoPlus size={28} />
        )}
      </div>
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium text-foreground">
          <IconPhotoPlus size={16} /> {value ? "Change" : label}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              // Reset first so picking the same file twice still fires change.
              event.target.value = "";
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                onChange(await readBusinessLogo(file));
              } catch (reason) {
                setError((reason as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        <span>{hint}</span>
        {error && (
          <span role="alert" className="text-destructive">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
