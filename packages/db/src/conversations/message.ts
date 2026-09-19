import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
    role: text("role").notNull(),
    content: text("content"),
    toolName: text("tool_name"),
    toolArgs: jsonb("tool_args"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("message_conversation_id_created_at_idx").on(t.conversationId, t.createdAt)],
);
