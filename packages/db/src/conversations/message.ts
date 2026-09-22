import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { generateId } from "../id";
import { conversation } from "./conversation";

export const message = pgTable(
  "message",
  {
    id: uuid("id")
      .$defaultFn(() => generateId())
      .primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    provider: text("provider"),
    rawUpdateId: text("raw_update_id"),
    role: text("role").notNull(),
    content: text("content"),
    toolName: text("tool_name"),
    toolArgs: jsonb("tool_args"),
    inboundResponse: text("inbound_response"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("message_conversation_id_created_at_idx").on(t.conversationId, t.createdAt),
    uniqueIndex("message_provider_raw_update_id_uidx").on(t.provider, t.rawUpdateId),
  ],
);
