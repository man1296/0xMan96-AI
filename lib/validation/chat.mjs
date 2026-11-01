import { z } from "zod";

export const CHAT_MODELS = ["openrouter/free"];

export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(12000)
  }).strict()).min(1).max(20),
  model: z.enum(CHAT_MODELS).optional()
}).strict();
