export type ChatPictureProps = { organizationId: string; file: File; onClose: () => void };
export type ChatPanelProps = { organizationId: string; canWrite: boolean };

export type VoiceNoteOptions = {
  path: string;
  setText: (value: string) => void;
  setError: (value: string) => void;
  setBusy: (value: boolean) => void;
};

export type ChatComposerProps = {
  text: string;
  onTextChange: (text: string) => void;
  onSend: () => void;
  onAttach: () => void;
  onRecord: () => void;
  canWrite: boolean;
  disabled: boolean;
  recordDisabled: boolean;
  recording: boolean;
};

export type ChatHistoryProps = {
  messages: import("./workspace.type").ChatMessage[];
  busy: boolean;
  setText(value: string): void;
  send(body: { messageId: string; confirm: boolean }): Promise<void>;
};
