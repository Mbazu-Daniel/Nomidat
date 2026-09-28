import { useEffect, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { PictureImport } from "./picture-import";
import type { ChatPictureProps } from "./types/chat-picture.type";
import type { PictureImportProps } from "./types/picture.type";
import "./chat-picture.css";

export function ChatPicture({ organizationId, file, onClose }: ChatPictureProps) {
  const [purpose, setPurpose] = useState<PictureImportProps["section"] | null>(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (purpose)
    return (
      <div className="chat-picture-review">
        <PictureImport
          organizationId={organizationId}
          section={purpose}
          initialFile={file}
          onSaved={onClose}
          onCancel={onClose}
        />
      </div>
    );
  return (
    <section className="chat-picture" aria-label="Attached picture">
      <div className="chat-picture-heading">
        {preview && <img src={preview} alt="Attached picture preview" />}
        <div>
          <strong>{file.name}</strong>
          <p>What would you like to do with this picture?</p>
        </div>
        <button
          type="button"
          className="workspace-icon-button"
          aria-label="Remove attached picture"
          onClick={onClose}
        >
          <IconX size={18} />
        </button>
      </div>
      <div className="chat-picture-actions">
        <button
          type="button"
          className="workspace-secondary"
          onClick={() => setPurpose("expenses")}
        >
          Record an expense
        </button>
        <button type="button" className="workspace-secondary" onClick={() => setPurpose("sales")}>
          Record a sale
        </button>
        <button
          type="button"
          className="workspace-secondary"
          onClick={() => setPurpose("invoices")}
        >
          Create an invoice
        </button>
        <button
          type="button"
          className="workspace-secondary"
          onClick={() => setPurpose("inventory")}
        >
          Add inventory
        </button>
      </div>
      <p className="chat-picture-hint">
        Choose an action, then read and review the picture before saving. Nothing is sent until you
        choose “Read picture”.
      </p>
    </section>
  );
}
