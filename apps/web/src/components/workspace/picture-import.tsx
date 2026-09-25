import { useEffect, useState } from "react";
import { IconPhoto, IconUpload } from "@tabler/icons-react";
import { createApiRequest } from "@/lib/api";
import { getPictureFileError } from "./picture-file";
import { RecordForm } from "./record-form";
import { TransactionForm } from "./transaction-form";
import { InventoryPictureReview } from "./inventory-picture-review";
import type { PictureDraft, PictureImportProps } from "./types/picture.type";
import "./picture-import.css";

export function PictureImport(props: PictureImportProps) {
  const [file, setFile] = useState<File | null>(props.initialFile ?? null);
  const [preview, setPreview] = useState("");
  const [draft, setDraft] = useState<PictureDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <section className="workspace-card picture-import">
      <div className="picture-review-heading">
        <div>
          <p className="workspace-eyebrow">PICTURE TO RECORD</p>
          <h2>{draft ? "Review your picture" : `Record ${props.section} from a picture`}</h2>
        </div>
        {!draft && (
          <button className="workspace-secondary" disabled={busy} onClick={props.onCancel}>
            Cancel
          </button>
        )}
      </div>
      {!draft && (
        <>
          <p>
            {props.section === "expenses"
              ? "Upload one receipt or bill. We’ll read the total, description and date for you to review before saving."
              : props.section === "invoices"
                ? "Upload one invoice or handwritten order. Review its customer, line items and due date before creating a new invoice."
                : "Upload a receipt, handwritten list or product photo. We’ll read the details and let you check them before saving."}
          </p>
          <label className="picture-dropzone">
            <IconPhoto size={32} />
            <strong>{file ? file.name : "Choose a picture"}</strong>
            <span>JPEG, PNG or WebP · Up to 10 MB</span>
            <input
              type="file"
              aria-label="Choose a picture"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) => {
                const selected = event.target.files?.[0];
                setError("");
                setFile(null);
                if (!selected) return;
                const validationError = getPictureFileError(selected);
                if (validationError) {
                  setError(validationError);
                  return;
                }
                setFile(selected);
              }}
            />
          </label>
          <p className="picture-help">
            The picture is sent to our AI provider to read it. Missing or unclear details will need
            your input.
          </p>
        </>
      )}
      {preview && (
        <details className="picture-preview" open={!draft}>
          <summary>View original picture</summary>
          <img src={preview} alt="Uploaded source for review" />
        </details>
      )}
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
      {!draft && (
        <div className="workspace-actions">
          <button
            className="workspace-primary"
            disabled={!file || busy}
            onClick={async () => {
              if (!file || busy) return;
              setBusy(true);
              setError("");
              const data = new FormData();
              data.append("picture", file);
              data.append("purpose", props.section);
              try {
                const result = await createApiRequest<PictureDraft>(
                  `/organizations/${props.organizationId}/picture-import`,
                  { method: "POST", body: data },
                );
                if ("expense" in result ? !result.expense : !result.items.length)
                  setError(
                    props.section === "expenses"
                      ? "No single expense could be read. Upload a clearer picture of one receipt or bill, or enter the details manually."
                      : "No items could be read. Try a clearer picture with names and quantities, or enter them manually.",
                  );
                else setDraft(result);
              } catch (reason) {
                setError((reason as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <IconUpload size={18} />
            {busy ? "Reading picture…" : "Read picture"}
          </button>
        </div>
      )}
      {busy && <p role="status">Reading the picture’s details. This can take up to a minute.</p>}
      {draft && (
        <>
          <p className="picture-review-notice">
            Only items you explicitly save are recorded. Check every detail against your picture.
          </p>
          {draft.warnings.length > 0 && (
            <ul className="picture-warnings">
              {draft.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          )}
          {props.section === "expenses" && "expense" in draft && draft.expense && (
            <RecordForm {...props} expenseDraft={draft.expense} />
          )}
          {props.section === "invoices" && "invoice" in draft && (
            <TransactionForm {...props} pictureItems={draft.items} invoiceDraft={draft.invoice} />
          )}
          {props.section === "sales" && "items" in draft && (
            <TransactionForm {...props} pictureItems={draft.items} />
          )}
          {props.section === "inventory" && "items" in draft && (
            <InventoryPictureReview {...props} section="inventory" items={draft.items} />
          )}
        </>
      )}
    </section>
  );
}
