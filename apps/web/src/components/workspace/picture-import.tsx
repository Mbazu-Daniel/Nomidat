import { useEffect, useState } from "react";
import { IconPhoto, IconUpload } from "@tabler/icons-react";
import { createApiRequest } from "@/lib/api";
import { getPictureFileError } from "./picture-file";
import { RecordForm } from "./record-form";
import { TransactionForm } from "./transaction-form";
import { InventoryPictureReview } from "./inventory-picture-review";
import type { PictureDraft, PictureImportProps, PicturePickerProps } from "./types/picture.type";
import "./picture-import.css";

export function PictureImport(props: PictureImportProps) {
  const [file, setFile] = useState<File | null>(props.initialFile ?? null);
  const [preview, setPreview] = useState("");
  const { draft, busy, error, setError, read } = usePictureDraft(props);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const canRead = Boolean(file) && !busy;
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
        <PicturePicker
          section={props.section}
          file={file}
          busy={busy}
          setFile={setFile}
          setError={setError}
        />
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
          <button className="workspace-primary" disabled={!canRead} onClick={() => void read(file)}>
            <IconUpload size={18} />
            {busy ? "Reading picture…" : "Read picture"}
          </button>
        </div>
      )}
      {busy && <p role="status">Reading the picture’s details. This can take up to a minute.</p>}
      {draft && <PictureReview {...props} draft={draft} />}
    </section>
  );
}

function requirePictureDraft(result: PictureDraft, section: PictureImportProps["section"]) {
  if ("expense" in result ? Boolean(result.expense) : result.items.length > 0) return result;
  throw new Error(
    section === "expenses"
      ? "No single expense could be read. Upload a clearer picture of one receipt or bill, or enter the details manually."
      : "No items could be read. Try a clearer picture with names and quantities, or enter them manually.",
  );
}

function PictureReview(props: PictureImportProps & { draft: PictureDraft }) {
  const { draft } = props;
  return (
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
  );
}

function PicturePicker({ section, file, busy, setFile, setError }: PicturePickerProps) {
  return (
    <>
      <p>
        {section === "expenses"
          ? "Upload one receipt or bill. We’ll read the total, description and date for you to review before saving."
          : section === "invoices"
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
        The picture is sent to our AI provider to read it. Missing or unclear details will need your
        input.
      </p>
    </>
  );
}

async function readPicture(file: File, props: PictureImportProps) {
  const data = new FormData();
  data.append("picture", file);
  data.append("purpose", props.section);
  return createApiRequest<PictureDraft>(`/organizations/${props.organizationId}/picture-import`, {
    method: "POST",
    body: data,
  });
}

function usePictureDraft(props: PictureImportProps) {
  const [draft, setDraft] = useState<PictureDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function read(file: File | null) {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await readPicture(file, props);
      setDraft(requirePictureDraft(result, props.section));
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { draft, busy, error, setError, read };
}
