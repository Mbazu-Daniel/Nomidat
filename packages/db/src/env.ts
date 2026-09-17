import { z } from "zod";

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().nonempty(),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

export function parseDatabaseEnv(input: NodeJS.ProcessEnv = process.env): DatabaseEnv {
  return databaseEnvSchema.parse(input);
}
