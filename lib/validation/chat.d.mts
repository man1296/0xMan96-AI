import type { z } from "zod";
type ChatRequest = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
};
export const chatRequestSchema: z.ZodType<ChatRequest>;
