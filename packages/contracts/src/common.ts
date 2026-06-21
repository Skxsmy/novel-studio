import { z } from "zod";

export const CloudPolicySchema = z.enum(["local-only", "cloud-allowed"]);
export type CloudPolicy = z.infer<typeof CloudPolicySchema>;

export const RevisionHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export type RevisionHash = z.infer<typeof RevisionHashSchema>;
