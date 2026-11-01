import { z } from "zod";

export const CHAT_MODELS = [
  "anthropic/claude-opus-5",
  "qwen/qwen3.8-max",
  "meta/muse-spark-1.2"
];

export const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(12000)
  }).strict()).min(1).max(20),
  model: z.enum(CHAT_MODELS).optional()
}).strict();
