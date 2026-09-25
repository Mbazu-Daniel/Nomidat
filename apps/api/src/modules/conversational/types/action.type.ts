import type { z } from "zod";
import type { parsedActionSchema } from "../action-schema";
export type ParsedAction = z.infer<typeof parsedActionSchema>;
export type ChatActor = { organizationId: string; userId: string; role: string };
