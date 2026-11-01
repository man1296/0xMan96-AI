export const MAX_WORKFLOW_STEPS = 6;
export const MAX_STEP_INPUT_CHARS = 12000;

export type WorkflowTool = "agent.reason" | "memory.search" | "memory.save";
export type WorkflowStep = {
  id: string;
  name: string;
  tool: WorkflowTool;
  input: Record<string, unknown>;
  requiresApproval: boolean;
};

const ALLOWED_TOOLS = new Set<WorkflowTool>(["agent.reason", "memory.search", "memory.save"]);

export function validateWorkflowSteps(value: unknown): WorkflowStep[] {
  if (!Array.isArray(value) || value.length > MAX_WORKFLOW_STEPS) {
    throw new Error("workflow_steps_must_be_array_of_at_most_six");
  }
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("invalid_workflow_step");
    }
    const item = raw as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const tool = item.tool as WorkflowTool;
    const input = item.input;
    if (!name || name.length > 240 || !ALLOWED_TOOLS.has(tool)) {
      throw new Error("invalid_workflow_step_definition");
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("workflow_step_input_must_be_object");
    }
    const serialized = JSON.stringify(input);
    if (serialized.length > MAX_STEP_INPUT_CHARS) {
      throw new Error("workflow_step_input_too_large");
    }
    const requiresApproval = tool === "memory.save" || item.requiresApproval === true;
    if (tool === "agent.reason") {
      const prompt = (input as Record<string, unknown>).prompt;
      if (typeof prompt !== "string" || !prompt.trim() || prompt.length > MAX_STEP_INPUT_CHARS) {
        throw new Error("agent_reason_requires_prompt");
      }
    }
    if (tool === "memory.search") {
      const query = (input as Record<string, unknown>).query;
      if (typeof query !== "string" || !query.trim() || query.length > 300) {
        throw new Error("memory_search_requires_query");
      }
    }
    if (tool === "memory.save") {
      const data = input as Record<string, unknown>;
      if (!["project_context", "preference", "decision", "research_finding", "standing_instruction", "feedback"].includes(String(data.category))) {
        throw new Error("invalid_memory_category");
      }
      if (typeof data.content !== "string" || !data.content.trim() || data.content.length > MAX_STEP_INPUT_CHARS) {
        throw new Error("memory_save_requires_content");
      }
      if (data.importance !== undefined && (!Number.isInteger(data.importance) || Number(data.importance) < 1 || Number(data.importance) > 5)) {
        throw new Error("invalid_memory_importance");
      }
    }
    return {
      id: typeof item.id === "string" && item.id.trim() ? item.id.slice(0, 80) : "step-" + (index + 1),
      name,
      tool,
      input: input as Record<string, unknown>,
      requiresApproval
    };
  });
}
