import { z } from "zod";

export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(12000)
  }).strict()).min(1).max(20),
  model: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9._:/-]+$/).optional()
}).strict();
