import { useApiResource } from "@/lib/use-api-resource";
import { ChatComposer } from "./chat-composer";
import { useVoiceNote } from "./use-voice-note";
import { useEffect, useRef, useState } from "react";
import { IconSparkles } from "@tabler/icons-react";
import { createApiRequest } from "@/lib/api";
import { ChatPicture } from "./chat-picture";
import { getPictureFileError } from "./picture-file";
import type { ChatPanelProps, ChatHistoryProps } from "./types/chat-picture.type";
import type { ChatMessage } from "./types";

export function ChatPanel({ organizationId, canWrite }: ChatPanelProps) {
  const [attachment, setAttachment] = useState<File | null>(null);
  const attachmentInput = useRef<HTMLInputElement | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const path = `/organizations/${organizationId}/chat`;
  const {
    data: messages,
    setData: setMessages,
    error,
    setError,
  } = useApiResource<ChatMessage[]>(path, []);
  const { recording, startRecording, stopRecording } = useVoiceNote({
    path,
    setText,
    setError,
    setBusy,
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, [path]);
  async function send(body: { text: string } | { messageId: string; confirm: boolean }) {
    setBusy(true);
    setError("");
    try {
      await createApiRequest(path + ("text" in body ? "" : "/confirmation"), {
        method: "POST",
        body: JSON.stringify(body),
      });
      const rows = await createApiRequest<ChatMessage[]>(path);
      if (mounted.current) {
        setMessages(rows);
        if ("text" in body) setText("");
      }
    } catch (reason) {
      if (mounted.current) setError((reason as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <>
      <div className="workspace-heading">
        <div>
          <h1>Ask Nomidat</h1>
          <p>Type it, say it, get on with your day.</p>
        </div>
        <span className="workspace-badge">Private to you and this business</span>
      </div>
      <section className="workspace-card workspace-chat">
        <ChatHistory messages={messages} busy={busy} setText={setText} send={send} />

        {error && (
          <p role="alert" className="workspace-error">
            {error}
          </p>
        )}
        {attachment && (
          <ChatPicture
            organizationId={organizationId}
            file={attachment}
            onClose={() => setAttachment(null)}
          />
        )}
        <input
          ref={attachmentInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          aria-label="Attach a picture"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || !canWrite || busy || recording) return;
            const validationError = getPictureFileError(file);
            setError(validationError ?? "");
            if (!validationError) setAttachment(file);
          }}
        />
        <ChatComposer
          text={text}
          onTextChange={setText}
          onSend={() => void send({ text: text.trim() })}
          onAttach={() => attachmentInput.current?.click()}
          onRecord={() => (recording ? stopRecording() : void startRecording())}
          canWrite={canWrite}
          recording={recording}
          disabled={busy || recording || Boolean(attachment)}
          recordDisabled={busy || Boolean(attachment)}
        />
        <p className="workspace-chat-hint">
          {recording
            ? "Recording… tap stop when finished. Maximum 60 seconds."
            : attachment
              ? "Finish or cancel the picture review to continue chatting. Your typed message is kept."
              : "Attach a picture or review voice transcripts before sending. Changes require your confirmation."}
        </p>
      </section>
    </>
  );
}

function ChatHistory({ messages, busy, setText, send }: ChatHistoryProps) {
  return (
    <div className="workspace-chat-messages" role="log" aria-live="polite">
      {messages.length === 0 && (
        <div className="workspace-chat-welcome">
          <span className="workspace-icon">
            <IconSparkles size={28} />
          </span>
          <h2>What’s happening in your business?</h2>
          <p>I can help with stock checks, customer balances, sales and expenses.</p>
          <div>
            {[
              "Show my business summary",
              "How many bags of cement are in stock?",
              "Record a ₦5,000 transport expense",
            ].map((prompt) => (
              <button className="workspace-secondary" key={prompt} onClick={() => setText(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}
      {messages.map((item) => (
        <article key={item.id} className={`workspace-chat-message ${item.role}`}>
          <small>{item.role === "user" ? "You" : "Nomidat"}</small>
          <p>{item.content.replace(/ Reply CONFIRM [\s\S]*$/, "")}</p>
          {item.toolName === "pending_confirmation" && (
            <div className="workspace-actions">
              <button
                className="workspace-primary"
                disabled={busy}
                onClick={() => void send({ messageId: item.id, confirm: true })}
              >
                Confirm action
              </button>
              <button
                className="workspace-secondary"
                disabled={busy}
                onClick={() => void send({ messageId: item.id, confirm: false })}
              >
                Cancel
              </button>
            </div>
          )}
          {["confirmed", "cancelled", "failed"].includes(item.toolName ?? "") && (
            <span className="workspace-badge">{item.toolName}</span>
          )}
        </article>
      ))}
      {busy && <p role="status">Nomidat is working…</p>}
    </div>
  );
}
