import { z } from "zod";

export const RevisionHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export type RevisionHash = z.infer<typeof RevisionHashSchema>;
