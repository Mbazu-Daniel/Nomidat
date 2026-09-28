import { IconArrowUp, IconPaperclip, IconMicrophone, IconPlayerStop } from "@tabler/icons-react";
import type { ChatComposerProps } from "./types/chat-picture.type";
export function ChatComposer({
  text,
  onTextChange,
  onSend,
  onAttach,
  onRecord,
  canWrite,
  disabled,
  recordDisabled,
  recording,
}: ChatComposerProps) {
  return (
    <form
      className="workspace-chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && text.trim()) onSend();
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
        onChange={(event) => onTextChange(event.target.value)}
        disabled={disabled}
      />
      <div>
        {canWrite && (
          <button
            type="button"
            className="workspace-icon-button"
            aria-label="Attach picture"
            title="Attach picture"
            disabled={disabled}
            onClick={() => onAttach()}
          >
            <IconPaperclip size={21} />
          </button>
        )}
        <button
          type="button"
          className="workspace-icon-button"
          disabled={recordDisabled}
          aria-label={recording ? "Stop recording" : "Record voice note"}
          onClick={() => onRecord()}
        >
          {recording ? <IconPlayerStop size={21} /> : <IconMicrophone size={21} />}
        </button>
        <button
          type="submit"
          className="workspace-primary"
          disabled={disabled || !text.trim()}
          aria-label="Send message"
        >
          <IconArrowUp size={20} />
        </button>
      </div>
    </form>
  );
}
