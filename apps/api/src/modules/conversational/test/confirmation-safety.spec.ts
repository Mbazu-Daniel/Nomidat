import { describe, it, expect, vi } from "vitest";
import { createDbStub } from "../../../common/db/test/db.stub";
import { ConversationalService } from "../conversational.service";
import type { AiService } from "../ai.service";
import type { ActionsService } from "../actions.service";
import type { BusinessAuthService } from "../../business/business-auth.service";
import type { ChannelPictureReader } from "../channel-picture-reader";
const actor = { organizationId: "shop", userId: "user", role: "staff,expenses_writer" };
const action = { intent: "record_expense" as const, amountNaira: 100, description: "Fuel" };
const pending = {
  id: "pending",
  toolName: "pending_confirmation",
  createdAt: new Date(),
  toolArgs: action,
};
function setup(selects: unknown[][], returns: unknown[][] = []) {
  const stub = createDbStub(selects, returns);
  const executeAction = vi.fn().mockResolvedValue("Recorded expense");
  const authorizeWrite = vi.fn();
  const service = new ConversationalService(
    stub.db,
    {} as AiService,
    { executeAction } as unknown as ActionsService,
    { authorizeWrite } as unknown as BusinessAuthService,
    {} as ChannelPictureReader,
  );
  return { ...stub, service, executeAction, authorizeWrite };
}
describe("chat confirmations", () => {
  it("only prepares a write until a separate confirmation is received", async () => {
    const { service, executeAction, authorizeWrite, inserts } = setup(
      [[]],
      [[], [{ id: "pending", role: "assistant", toolName: "pending_confirmation" }]],
    );
    const result = await service.createMessage(actor, "Spent 100 on fuel", "thread", action, [
      "Check amount",
    ]);
    expect(result.content).toContain("CONFIRM pending");
    expect(result.content).toContain("Check amount");
    expect(executeAction).not.toHaveBeenCalled();
    expect(authorizeWrite).toHaveBeenCalledWith(actor.role, "expenses");
    expect(inserts).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "thread", toolName: "pending_confirmation" }),
    );
  });
  it("rejects expired and already handled confirmations without executing", async () => {
    const expired = setup([[{ ...pending, createdAt: new Date(0) }]]);
    await expect(
      expired.service.updateConfirmation(actor, "pending", true, "thread"),
    ).rejects.toThrow("expired");
    expect(expired.executeAction).not.toHaveBeenCalled();
    const replay = setup([[pending]], [[]]);
    await expect(
      replay.service.updateConfirmation(actor, "pending", true, "thread"),
    ).rejects.toThrow("already been handled");
    expect(replay.executeAction).not.toHaveBeenCalled();
  });
  it("claims the confirmation and checks the action-specific permission before executing", async () => {
    const { service, authorizeWrite, executeAction } = setup(
      [[pending]],
      [[pending], [], [{ content: "Recorded expense" }]],
    );
    await service.updateConfirmation(actor, "pending", true, "thread");
    expect(authorizeWrite).toHaveBeenCalledWith(actor.role, "expenses");
    expect(executeAction).toHaveBeenCalledOnce();
    expect(executeAction).toHaveBeenCalledWith(action, "shop", "user");
  });
  it("cancels a proposed action without any business write", async () => {
    const { service, executeAction, updates } = setup(
      [[pending]],
      [[pending], [{ content: "Cancelled" }]],
    );
    await service.updateConfirmation(actor, "pending", false, "thread");
    expect(executeAction).not.toHaveBeenCalled();
    expect(updates).toHaveBeenCalledWith({ toolName: "cancelled" });
  });
});
