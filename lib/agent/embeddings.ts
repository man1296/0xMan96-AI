import { getCloudflareContext } from "@opennextjs/cloudflare";

export const MEMORY_EMBEDDING_MODEL = "@cf/baai/bge-m3";
export const MEMORY_EMBEDDING_DIMENSIONS = 1024;

type WorkersAiBinding = {
  run(model: string, input: { text: string; pooling?: "mean" | "cls" }): Promise<unknown>;
};

function readVector(payload: unknown): number[] | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown; result?: { data?: unknown } }).data
    ?? (payload as { result?: { data?: unknown } }).result?.data;
  if (!Array.isArray(data)) return null;
  const vector = Array.isArray(data[0]) ? data[0] : data;
  if (!Array.isArray(vector) || vector.length !== MEMORY_EMBEDDING_DIMENSIONS) return null;
  const values = vector.map(Number);
  if (values.some(value => !Number.isFinite(value))) return null;
  return values;
}

export async function generateMemoryEmbedding(content: string): Promise<number[] | null> {
  const text = String(content ?? "").trim().slice(0, 6000);
  if (!text) return null;
  try {
    const context = getCloudflareContext();
    const ai = (context.env as unknown as { AI?: WorkersAiBinding }).AI;
    if (!ai || typeof ai.run !== "function") return null;
    const response = await ai.run(MEMORY_EMBEDDING_MODEL, { text, pooling: "mean" });
    return readVector(response);
  } catch {
    // Local development and Workers without the optional AI binding use lexical retrieval.
    return null;
  }
}

type MemorySearchArgs = {
  workspaceId: string;
  userId: string;
  query: string;
  limit?: number;
};

export async function findRelevantMemories(supabase: any, args: MemorySearchArgs): Promise<Array<Record<string, unknown>>> {
  const query = String(args.query ?? "").trim().slice(0, 300);
  if (!query) return [];
  const limit = Math.max(1, Math.min(args.limit ?? 8, 20));
  const embedding = await generateMemoryEmbedding(query);

  if (embedding) {
    const { data, error } = await supabase.rpc("match_agent_memories", {
      p_workspace_id: args.workspaceId,
      p_user_id: args.userId,
      p_query_embedding: embedding,
      p_match_count: limit,
      p_match_threshold: 0.32
    });
    if (!error && Array.isArray(data) && data.length > 0) return data;
  }

  const term = (query.match(/[\p{L}\p{N}]{3,}/gu) ?? [])[0];
  if (term) {
    const { data, error } = await supabase.from("agent_memories")
      .select("id,category,content,importance,pinned,created_at")
      .eq("workspace_id", args.workspaceId).eq("user_id", args.userId)
      .ilike("content", "%" + term + "%")
      .order("pinned", { ascending: false }).order("importance", { ascending: false })
      .order("updated_at", { ascending: false }).limit(limit);
    if (!error && Array.isArray(data) && data.length > 0) return data;
  }

  const { data, error } = await supabase.from("agent_memories")
    .select("id,category,content,importance,pinned,created_at")
    .eq("workspace_id", args.workspaceId).eq("user_id", args.userId)
    .order("pinned", { ascending: false }).order("importance", { ascending: false })
    .order("updated_at", { ascending: false }).limit(limit);
  return !error && Array.isArray(data) ? data : [];
}
