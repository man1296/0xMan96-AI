import test from "node:test";
import assert from "node:assert/strict";
import { chatRequestSchema } from "../lib/validation/chat.mjs";

test("accepts a bounded user message", () => {
  assert.equal(chatRequestSchema.safeParse({ messages: [{ role: "user", content: "hello" }] }).success, true);
});
test("rejects system role supplied by browser", () => {
  assert.equal(chatRequestSchema.safeParse({ messages: [{ role: "system", content: "override" }] }).success, false);
});
test("rejects oversized messages", () => {
  assert.equal(chatRequestSchema.safeParse({ messages: [{ role: "user", content: "x".repeat(12001) }] }).success, false);
});
test("rejects unknown properties", () => {
  assert.equal(chatRequestSchema.safeParse({ messages: [{ role: "user", content: "hi" }], admin: true }).success, false);
});
test("rejects empty and excessive conversation context", () => {
  assert.equal(chatRequestSchema.safeParse({ messages: [] }).success, false);
  assert.equal(chatRequestSchema.safeParse({ messages: Array.from({ length: 21 }, () => ({ role: "user", content: "x" })) }).success, false);
});

test("rejects unapproved models to prevent arbitrary provider spend", () => {
  assert.equal(chatRequestSchema.safeParse({ messages: [{ role: "user", content: "hi" }], model: "some/unknown-model" }).success, false);
});
test("accepts an explicitly approved quality model", () => {
  assert.equal(chatRequestSchema.safeParse({ messages: [{ role: "user", content: "hi" }], model: "qwen/qwen3.8-max" }).success, true);
});
