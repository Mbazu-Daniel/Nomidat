import { actionWriteArea } from "./action-permissions";
import { ChannelPictureReader } from "./channel-picture-reader";
import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNull, sql } from "@nomidat/db";
import { channelIdentity, conversation, inboundUpdate, member, message } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { BusinessAuthService } from "../business/business-auth.service";
import type { ChannelAdapter, InboundMessage } from "../channel/types";
import { ActionsService } from "./actions.service";
import { AiService } from "./ai.service";
import { getActionReview, getMissingActionDetails } from "./action-review";
import { parsedActionSchema, writeActions } from "./action-schema";
import type { ChatActor, ParsedAction } from "./types";

@Injectable()
export class ConversationalService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly ai: AiService,
    private readonly actions: ActionsService,
    private readonly auth: BusinessAuthService,
    private readonly channelPictures: ChannelPictureReader,
  ) {}

  async processInbound(
    inbound: InboundMessage,
    organizationId: string,
    identityId: string,
    adapter: ChannelAdapter,
  ) {
    if (!inbound.rawUpdateId)
      return this.createInboundMessage(inbound, organizationId, identityId, adapter);
    const predicate = and(
      eq(inboundUpdate.organizationId, organizationId),
      eq(inboundUpdate.provider, inbound.provider),
      eq(inboundUpdate.rawUpdateId, inbound.rawUpdateId),
    );
    const [claimed] = await this.db
      .insert(inboundUpdate)
      .values({ organizationId, provider: inbound.provider, rawUpdateId: inbound.rawUpdateId })
      .onConflictDoNothing()
      .returning();
    if (!claimed) {
      const [existing] = await this.db.select().from(inboundUpdate).where(predicate).limit(1);
      return existing?.response ?? "This message is already being processed.";
    }
    try {
      const response = await this.createInboundMessage(
        inbound,
        organizationId,
        identityId,
        adapter,
      );
      await this.db
        .update(inboundUpdate)
        .set({ response, completedAt: new Date() })
        .where(eq(inboundUpdate.id, claimed.id));
      return response;
    } catch (error) {
      await this.db.delete(inboundUpdate).where(eq(inboundUpdate.id, claimed.id));
      throw error;
    }
  }

  private async createInboundMessage(
    inbound: InboundMessage,
    organizationId: string,
    identityId: string,
    adapter: ChannelAdapter,
  ) {
    const [identity] = await this.db
      .select({ userId: channelIdentity.userId, role: member.role })
      .from(channelIdentity)
      .innerJoin(
        member,
        and(
          eq(member.userId, channelIdentity.userId),
          eq(member.organizationId, channelIdentity.organizationId),
        ),
      )
      .where(
        and(eq(channelIdentity.id, identityId), eq(channelIdentity.organizationId, organizationId)),
      )
      .limit(1);
    if (!identity?.userId)
      throw new ForbiddenException(
        "Please relink your channel from the dashboard. Active membership is required.",
      );
    const actor = { organizationId, userId: identity.userId, role: identity.role };
    if (inbound.kind === "image") {
      this.auth.authorizeWrite(actor.role);
      const thread = await this.getConversation(actor, identityId);
      const facts = await this.channelPictures.read(inbound, adapter);
      return (await this.createMessage(actor, facts.text, thread.id, facts.action, facts.warnings))
        .content;
    }
    if (inbound.kind === "document")
      throw new BadRequestException(
        "Send a JPEG, PNG or WebP picture with caption expense, sale, invoice or inventory.",
      );
    const text =
      inbound.kind === "voice"
        ? await this.ai.transcribeVoice(inbound, adapter)
        : inbound.text?.trim();
    if (!text) throw new BadRequestException("Please send text or a clearer voice note.");
    const thread = await this.getConversation(actor, identityId);
    const match = /^(confirm|cancel) ([0-9a-f-]{36})$/i.exec(text);
    if (match)
      return (
        await this.updateConfirmation(
          actor,
          match[2],
          match[1].toLowerCase() === "confirm",
          thread.id,
        )
      ).content!;
    return (await this.createMessage(actor, text, thread.id)).content;
  }

  async getConversation(actor: ChatActor, identityId?: string) {
    // Serialize creation across workers, keeping each user's browser history separate from channel history.
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${actor.organizationId + actor.userId + (identityId ?? "web")}))`,
      );
      const predicate = and(
        eq(conversation.organizationId, actor.organizationId),
        eq(conversation.createdByUserId, actor.userId),
        identityId
          ? eq(conversation.channelIdentityId, identityId)
          : isNull(conversation.channelIdentityId),
      );
      const [existing] = await tx.select().from(conversation).where(predicate).limit(1);
      if (existing) return existing;
      const [created] = await tx
        .insert(conversation)
        .values({
          organizationId: actor.organizationId,
          createdByUserId: actor.userId,
          channelIdentityId: identityId,
        })
        .returning();
      return created;
    });
  }

  async getMessages(actor: ChatActor) {
    const thread = await this.getConversation(actor);
    const rows = await this.db
      .select({
        id: message.id,
        role: message.role,
        content: message.content,
        toolName: message.toolName,
        createdAt: message.createdAt,
      })
      .from(message)
      .where(eq(message.conversationId, thread.id))
      .orderBy(desc(message.createdAt), desc(message.id))
      .limit(50);
    return rows.reverse();
  }

  async createMessage(
    actor: ChatActor,
    text: string,
    conversationId?: string,
    preparedAction?: ParsedAction,
    warnings: string[] = [],
  ) {
    const threadId = conversationId ?? (await this.getConversation(actor)).id;
    await this.db.insert(message).values({ conversationId: threadId, role: "user", content: text });
    const history = await this.db
      .select({ role: message.role, content: message.content })
      .from(message)
      .where(eq(message.conversationId, threadId))
      .orderBy(desc(message.createdAt))
      .limit(20);
    const action = preparedAction
      ? parsedActionSchema.parse(preparedAction)
      : await this.ai.understand(history.reverse());
    const missing = getMissingActionDetails(action);
    const write = writeActions.has(action.intent) && !missing;
    if (write) this.auth.authorizeWrite(actor.role, actionWriteArea(action.intent));
    let content: string;
    if (missing) content = missing;
    else if (write) content = getActionReview(action);
    else content = await this.actions.executeAction(action, actor.organizationId, actor.userId);
    if (warnings.length)
      content += `\nPicture notes: ${warnings
        .slice(0, 3)
        .map((warning) => warning.slice(0, 180))
        .join("; ")}`;
    const [reply] = await this.db
      .insert(message)
      .values({
        conversationId: threadId,
        role: "assistant",
        content,
        toolName: write ? "pending_confirmation" : action.intent,
        toolArgs: action,
      })
      .returning();
    if (write) {
      content += ` Reply CONFIRM ${reply.id} to proceed, or CANCEL ${reply.id}. This request expires in 10 minutes.`;
      await this.db.update(message).set({ content }).where(eq(message.id, reply.id));
    }
    return { id: reply.id, role: reply.role, content, toolName: reply.toolName };
  }

  async updateConfirmation(
    actor: ChatActor,
    messageId: string,
    confirm: boolean,
    conversationId?: string,
  ) {
    this.auth.authorizeWrite(actor.role);
    const threadId = conversationId ?? (await this.getConversation(actor)).id;
    const [pending] = await this.db
      .select()
      .from(message)
      .where(and(eq(message.id, messageId), eq(message.conversationId, threadId)))
      .limit(1);
    if (!pending || pending.toolName !== "pending_confirmation")
      throw new BadRequestException("This action is no longer awaiting confirmation.");
    if (Date.now() - pending.createdAt.getTime() > 600_000)
      throw new BadRequestException("This request expired. Please send it again.");
    const action = parsedActionSchema.parse(pending.toolArgs);
    if (confirm) this.auth.authorizeWrite(actor.role, actionWriteArea(action.intent));
    // A compare-and-set claim prevents two confirmations from executing the same write.
    const [claimed] = await this.db
      .update(message)
      .set({ toolName: confirm ? "executing" : "cancelled" })
      .where(
        and(
          eq(message.id, messageId),
          eq(message.conversationId, threadId),
          eq(message.toolName, "pending_confirmation"),
        ),
      )
      .returning();
    if (!claimed) throw new BadRequestException("This action has already been handled.");
    let content = "Action cancelled. No business records changed.";
    if (confirm) {
      try {
        content = await this.actions.executeAction(action, actor.organizationId, actor.userId);
      } catch {
        content =
          "The action could not be completed reliably. Check your records before submitting it again.";
        await this.db.update(message).set({ toolName: "failed" }).where(eq(message.id, messageId));
        const [reply] = await this.db
          .insert(message)
          .values({ conversationId: threadId, role: "assistant", content, toolName: "failed" })
          .returning();
        return reply;
      }
      await this.db.update(message).set({ toolName: "confirmed" }).where(eq(message.id, messageId));
    }
    const [reply] = await this.db
      .insert(message)
      .values({ conversationId: threadId, role: "assistant", content })
      .returning();
    return reply;
  }
}
