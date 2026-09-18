export type TelegramUpdateMessage = {
  message_id: number;
  text?: string;
  caption?: string;
  voice?: { file_id: string; mime_type?: string };
  document?: { file_id: string; mime_type?: string; file_name?: string };
  chat: { id: number; first_name?: string; username?: string; title?: string };
  from?: { first_name?: string; username?: string };
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramUpdateMessage;
};
