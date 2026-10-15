import { z } from "zod";

export const retentionDraftSchema = z.object({
  days: z.union([z.literal(""), z.coerce.number().int().min(1).max(36500)])
    .transform(value => value === "" ? null : value),
  hold: z.boolean(),
});
