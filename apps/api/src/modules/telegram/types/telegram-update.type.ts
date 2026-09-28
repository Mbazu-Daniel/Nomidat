export type TelegramUpdateMessage = {
  message_id: number;
  text?: string;
  caption?: string;
  photo?: { file_id: string; width: number; height: number; file_size?: number }[];
  voice?: { file_id: string; mime_type?: string };
  document?: { file_id: string; mime_type?: string; file_name?: string };
  chat: {
    type: "private" | "group" | "supergroup" | "channel";
    id: number;
    first_name?: string;
    username?: string;
    title?: string;
  };
  from?: { first_name?: string; username?: string };
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramUpdateMessage;
};
