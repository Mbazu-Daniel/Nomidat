import { useEffect, useRef, useState } from "react";
import {
  IconArrowUp,
  IconPaperclip,
  IconMicrophone,
  IconPlayerStop,
  IconSparkles,
} from "@tabler/icons-react";
import { createApiRequest } from "@/lib/api";
import { ChatPicture } from "./chat-picture";
import { getPictureFileError } from "./picture-file";
import type { ChatPanelProps } from "./types/chat-picture.type";
import type { ChatMessage } from "./types";

export function ChatPanel({ organizationId, canWrite }: ChatPanelProps) {
  const [attachment, setAttachment] = useState<File | null>(null);
  const attachmentInput = useRef<HTMLInputElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const path = `/organizations/${organizationId}/chat`;
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void createApiRequest<ChatMessage[]>(path)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
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
  async function startRecording() {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "Voice recording is unavailable in this browser. You can still type your message.",
        );
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const next = new MediaRecorder(media);
      recorder.current = next;
      const chunks: Blob[] = [];
      next.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      next.onstop = async () => {
        media.getTracks().forEach((track) => track.stop());
        if (timer.current) clearTimeout(timer.current);
        if (!mounted.current) return;
        setRecording(false);
        setBusy(true);
        try {
          const blob = new Blob(chunks, { type: next.mimeType });
          if (!blob.size || blob.size > 10 * 1024 * 1024)
            throw new Error(
              "Recording must be between 1 byte and 10 MB. Please try a shorter note.",
            );
          const form = new FormData();
          form.append("audio", blob, "voice.webm");
          const result = await createApiRequest<{ text: string }>(path + "/voice", {
            method: "POST",
            body: form,
          });
          if (mounted.current) setText(result.text);
        } catch (reason) {
          if (mounted.current) setError((reason as Error).message);
        } finally {
          if (mounted.current) setBusy(false);
        }
      };
      next.start();
      setRecording(true);
      timer.current = setTimeout(() => {
        if (next.state === "recording") next.stop();
      }, 60_000);
    } catch (reason) {
      stream.current?.getTracks().forEach((track) => track.stop());
      setError((reason as Error).message);
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
                  <button
                    className="workspace-secondary"
                    key={prompt}
                    onClick={() => setText(prompt)}
                  >
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
        <form
          className="workspace-chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (!attachment && !busy && !recording && text.trim()) void send({ text: text.trim() });
          }}
        >
          <label className="sr-only" htmlFor="chat-message">
            Message
          </label>
          <textarea
            id="chat-message"
            rows={2}
            placeholder="Ask a question or record something…"
            value={text}
            maxLength={4000}
            onChange={(event) => setText(event.target.value)}
            disabled={busy || recording || Boolean(attachment)}
          />
          <div>
            {canWrite && (
              <button
                type="button"
                className="workspace-icon-button"
                aria-label="Attach picture"
                title="Attach picture"
                disabled={busy || recording || Boolean(attachment)}
                onClick={() => attachmentInput.current?.click()}
              >
                <IconPaperclip size={21} />
              </button>
            )}
            <button
              type="button"
              className="workspace-icon-button"
              disabled={busy || Boolean(attachment)}
              aria-label={recording ? "Stop recording" : "Record voice note"}
              onClick={() => (recording ? recorder.current?.stop() : void startRecording())}
            >
              {recording ? <IconPlayerStop size={21} /> : <IconMicrophone size={21} />}
            </button>
            <button
              type="submit"
              className="workspace-primary"
              disabled={busy || recording || Boolean(attachment) || !text.trim()}
              aria-label="Send message"
            >
              <IconArrowUp size={20} />
            </button>
          </div>
        </form>
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
