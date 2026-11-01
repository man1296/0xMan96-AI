"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";

function renderAgentContent(content: string) {
  return content.split(/(https?:\/\/[^\s<>"')]+)/g).map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return part;
    const url = part.replace(/[.,;:!?]+$/, "");
    const trailing = part.slice(url.length);
    return <span key={index}><a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#bba6ff", textDecoration: "underline", overflowWrap: "anywhere" }}>{url}</a>{trailing}</span>;
  });
}

type Agent = { id: string; name: string; description?: string; instructions?: string };
type Workflow = { id: string; name: string; description?: string; trigger_type?: string; trigger_config?: { interval?: string }; enabled?: boolean; next_run_at?: string | null; last_triggered_at?: string | null; steps: Array<{ name: string; tool: string; input: Record<string, unknown>; requiresApproval: boolean }> };
type WorkflowRun = { id: string; workflow_id: string | null; agent_task_id: string | null; status: string; created_at: string; started_at?: string | null; completed_at?: string | null };
type WorkflowStepRun = { id: string; run_id: string; step_index: number; name: string; status: string; requires_approval: boolean; input: Record<string, unknown>; output?: Record<string, unknown> | null; error_code?: string | null };
type AgentTask = {
  id: string;
  task: string;
  status: string;
  approval?: { summary?: string; pending_step_index?: number; tool?: string } | null;
  attempts?: number;
  results?: Array<{ type?: string; content?: string }>;
  last_error?: string | null;
  created_at?: string;
};
type Memory = {
  id: string;
  category: string;
  content: string;
  importance: number;
  pinned: boolean;
  updated_at?: string;
};

const panel: CSSProperties = {
  background: "#11131d",
  border: "1px solid #272a39",
  borderRadius: 16,
  padding: 18
};
const muted: CSSProperties = { color: "#9a9db0" };
const button: React.CSSProperties = {
  border: "1px solid #393d52",
  borderRadius: 10,
  padding: "10px 14px",
  background: "#191c29",
  color: "#f5f3ff",
  cursor: "pointer"
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.error === "string" ? data.error : "request_failed";
    throw new Error(message);
  }
  return data as T;
}

export default function AgentWorkspace({ workspaceId, workspaceName, userEmail }: {
  workspaceId: string;
  workspaceName: string;
  userEmail: string;
}) {
  const [tab, setTab] = useState<"chat" | "memory" | "workflows" | "runs">("chat");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [workflowStepRuns, setWorkflowStepRuns] = useState<WorkflowStepRun[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [workflowName, setWorkflowName] = useState("");
  const [workflowStepsText, setWorkflowStepsText] = useState("Research the task and identify reliable sources.\nSynthesize the findings into a clear final answer.");
  const [scheduleInterval, setScheduleInterval] = useState<"manual" | "hourly" | "daily" | "weekly">("manual");
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [memoryText, setMemoryText] = useState("");
  const [memoryCategory, setMemoryCategory] = useState("project_context");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [error, setError] = useState("");

  const activeTasks = useMemo(
    () => tasks.some(task => ["queued", "planning", "running"].includes(task.status)),
    [tasks]
  );

  const loadTasks = useCallback(async () => {
    const response = await fetch("/api/v1/agent/tasks?workspaceId=" + encodeURIComponent(workspaceId), { cache: "no-store" });
    const data = await readJson<{ tasks: AgentTask[] }>(response);
    setTasks(data.tasks ?? []);
  }, [workspaceId]);

  const loadWorkflowRuns = useCallback(async () => {
    const response = await fetch("/api/v1/workflows/runs?workspaceId=" + encodeURIComponent(workspaceId), { cache: "no-store" });
    const data = await readJson<{ runs: WorkflowRun[]; steps: WorkflowStepRun[] }>(response);
    setWorkflowRuns(data.runs ?? []);
    setWorkflowStepRuns(data.steps ?? []);
  }, [workspaceId]);

  const loadWorkflows = useCallback(async () => {
    const response = await fetch("/api/v1/workflows?workspaceId=" + encodeURIComponent(workspaceId), { cache: "no-store" });
    const data = await readJson<{ workflows: Workflow[] }>(response);
    setWorkflows(data.workflows ?? []);
  }, [workspaceId]);

  const loadMemories = useCallback(async () => {
    const response = await fetch("/api/v1/agent/memories?workspaceId=" + encodeURIComponent(workspaceId), { cache: "no-store" });
    const data = await readJson<{ memories: Memory[] }>(response);
    setMemories(data.memories ?? []);
  }, [workspaceId]);

  const loadAgents = useCallback(async () => {
    const response = await fetch("/api/v1/agents?workspaceId=" + encodeURIComponent(workspaceId), { cache: "no-store" });
    const data = await readJson<{ agents: Agent[] }>(response);
    let items = data.agents ?? [];
    if (!items.length) {
      const created = await fetch("/api/v1/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          name: "Workspace Agent",
          description: "Your task-focused workspace assistant.",
          instructions: "Help the user complete tasks accurately. Use workspace Memory as supporting context. Be explicit about uncertainty and never claim to have performed external actions unless a permitted tool confirms success."
        })
      });
      const result = await readJson<{ agent: Agent }>(created);
      items = result.agent ? [result.agent] : [];
    }
    setAgents(items);
  }, [workspaceId]);

  useEffect(() => {
    let alive = true;
    async function initialize() {
      setLoading(true);
      setError("");
      try {
        await Promise.all([loadAgents(), loadTasks(), loadMemories(), loadWorkflows(), loadWorkflowRuns()]);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "workspace_load_failed");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void initialize();
    return () => { alive = false; };
  }, [loadAgents, loadTasks, loadMemories, loadWorkflows, loadWorkflowRuns]);

  useEffect(() => {
    if (!activeTasks) return;
    const timer = window.setInterval(() => {
      void loadTasks().catch(() => undefined);
      void loadWorkflowRuns().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeTasks, loadTasks, loadWorkflowRuns]);

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const taskText = prompt.trim();
    if (!taskText || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/agent/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, agentId: agents[0]?.id, workflowId: selectedWorkflowId || undefined, task: taskText })
      });
      const data = await readJson<{ task: { id: string; status: string; created_at: string } }>(response);
      setPrompt("");
      setTasks(current => [{
        id: data.task.id,
        task: taskText,
        status: data.task.status,
        results: [],
        created_at: data.task.created_at
      }, ...current.filter(item => item.id !== data.task.id)]);
      setTab("chat");
      void loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "task_enqueue_failed");
    } finally {
      setSending(false);
    }
  }

  async function createWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lines = workflowStepsText.split("\n").map(line => line.trim()).filter(Boolean);
    if (!workflowName.trim() || !lines.length || savingWorkflow) return;
    if (lines.length > 6) { setError("A Workflow can contain at most six steps."); return; }
    setSavingWorkflow(true);
    setError("");
    try {
      const response = await fetch("/api/v1/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          agentId: agents[0]?.id,
          name: workflowName.trim(),
          description: "User-defined sequential Agent workflow.",
          scheduleInterval: scheduleInterval === "manual" ? undefined : scheduleInterval,
          steps: lines.map((prompt, index) => ({
            id: "step-" + (index + 1),
            name: "Step " + (index + 1),
            tool: "agent.reason",
            input: { prompt },
            requiresApproval: false
          }))
        })
      });
      const data = await readJson<{ workflow: Workflow }>(response);
      setWorkflowName("");
      setScheduleInterval("manual");
      await loadWorkflows();
      setSelectedWorkflowId(data.workflow.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "workflow_create_failed");
    } finally {
      setSavingWorkflow(false);
    }
  }

  async function setWorkflowEnabled(workflowId: string, enabled: boolean) {
    setError("");
    try {
      await readJson(await fetch("/api/v1/workflows/" + encodeURIComponent(workflowId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, enabled })
      }));
      await loadWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "workflow_update_failed");
    }
  }

  async function decideApproval(taskId: string, approved: boolean) {
    setError("");
    try {
      await readJson(await fetch("/api/v1/agent/tasks/" + encodeURIComponent(taskId) + "/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved })
      }));
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "approval_update_failed");
    }
  }

  async function saveMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = memoryText.trim();
    if (!content || savingMemory) return;
    setSavingMemory(true);
    setError("");
    try {
      await readJson(await fetch("/api/v1/agent/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          category: memoryCategory,
          content,
          source: "user",
          importance: 3,
          pinned: false
        })
      }));
      setMemoryText("");
      await loadMemories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "memory_save_failed");
    } finally {
      setSavingMemory(false);
    }
  }

  const tabs = [
    { id: "chat" as const, label: "Agent" },
    { id: "memory" as const, label: "Memory" },
    { id: "workflows" as const, label: "Workflows" },
    { id: "runs" as const, label: "Workflow runs" }
  ];

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 18px 64px" }}>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 14, marginBottom: 26 }}>
        <div>
          <p style={{ color: "#b49aff", letterSpacing: 3, fontSize: 11, margin: "0 0 8px" }}>0XMAN96 / AGENT WORKSPACE</p>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 42px)", margin: 0 }}>{workspaceName}</h1>
          <p style={{ ...muted, margin: "8px 0 0", fontSize: 13 }}>{userEmail} · Agent, Memory and Workflow in one workspace</p>
        </div>
        <a href="/api/health" style={{ ...muted, fontSize: 12 }}>Runtime health ↗</a>
      </header>

      <nav aria-label="Workspace sections" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {tabs.map(item => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)} style={{
            ...button,
            background: tab === item.id ? "#a98bf4" : "#191c29",
            borderColor: tab === item.id ? "#a98bf4" : "#393d52",
            color: tab === item.id ? "#171320" : "#f5f3ff",
            fontWeight: 700
          }}>{item.label}</button>
        ))}
      </nav>

      {error && <p role="alert" style={{ color: "#ffaaaa", background: "#351b25", border: "1px solid #663344", borderRadius: 10, padding: 12 }}>{error}</p>}
      {loading ? <section style={panel}>Loading workspace context…</section> : (
        <>
          {tab === "chat" && (
            <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 270px", gap: 16 }}>
              <div style={{ ...panel, minHeight: 520, display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Task conversation</h2>
                  <p style={{ ...muted, margin: 0, fontSize: 13 }}>Send an instruction. The Agent creates a bounded plan, uses your saved context, executes each step, and records the result.</p>
                </div>
                <div style={{ display: "grid", gap: 12, flex: 1, alignContent: "start" }}>
                  {!tasks.length && <p style={muted}>No tasks yet. Start with a research, planning, analysis, or writing task.</p>}
                  {tasks.map(task => (
                    <article key={task.id} style={{ border: "1px solid #2c3041", borderRadius: 12, padding: 14, background: "#0c0e16" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
                        <strong style={{ fontSize: 13 }}>You</strong>
                        <span style={{ color: task.status === "succeeded" ? "#86ddb5" : task.status === "failed" ? "#ff9e9e" : "#d8c4ff", fontSize: 11, textTransform: "uppercase" }}>{task.status.replaceAll("_", " ")}</span>
                      </div>
                      <p style={{ whiteSpace: "pre-wrap", margin: "0 0 12px", lineHeight: 1.55 }}>{task.task}</p>
                      {task.results?.map((result, index) => result.content ? (
                        <div key={index} style={{ borderTop: "1px solid #2c3041", paddingTop: 12, color: "#d5d2e2", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                          <strong style={{ display: "block", color: "#b49aff", fontSize: 12, marginBottom: 6 }}>AGENT</strong>
                          {renderAgentContent(result.content)}
                        </div>
                      ) : null)}
                      {task.status === "awaiting_approval" && <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: "1px solid #8b6a35", background: "#2a2115" }}><strong style={{ color: "#f4cf8b", fontSize: 12 }}>Approval required</strong><p style={{ color: "#dfd0b4", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: 260, overflowY: "auto" }}>{task.approval?.summary || "This workflow step needs your approval before it can continue."}</p><div style={{ display: "flex", gap: 8 }}><button type="button" onClick={() => void decideApproval(task.id, true)} style={{ ...button, background: "#a98bf4", color: "#171320", fontWeight: 700 }}>Approve & resume</button><button type="button" onClick={() => void decideApproval(task.id, false)} style={button}>Reject</button></div></div>}
                      {task.last_error && <p style={{ color: "#ffaaaa", fontSize: 12, marginBottom: 0 }}>Error: {task.last_error}</p>}
                    </article>
                  ))}
                </div>
                <form onSubmit={submitTask} style={{ display: "grid", gap: 10 }}>
                  <textarea value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={12000} rows={3} placeholder="Give the Agent a task…" style={{ width: "100%", resize: "vertical", boxSizing: "border-box", background: "#0c0e16", border: "1px solid #393d52", borderRadius: 12, padding: 14, color: "#f5f3ff", font: "inherit" }} />
                  <select aria-label="Workflow" value={selectedWorkflowId} onChange={event => setSelectedWorkflowId(event.target.value)} style={{ background: "#0c0e16", border: "1px solid #393d52", borderRadius: 9, padding: 10, color: "#f5f3ff" }}><option value="">Default Agent task</option>{workflows.map(workflow => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}</select>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <span style={{ ...muted, fontSize: 11 }}>{agents[0]?.name ?? "Agent"} · background execution</span>
                    <button disabled={sending || !prompt.trim()} type="submit" style={{ ...button, background: "#a98bf4", borderColor: "#a98bf4", color: "#171320", fontWeight: 800, opacity: sending || !prompt.trim() ? .55 : 1 }}>{sending ? "Queueing…" : "Run task"}</button>
                  </div>
                </form>
              </div>
              <aside style={{ display: "grid", gap: 14, alignContent: "start" }}>
                <div style={panel}>
                  <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Workspace Agent</h3>
                  <p style={{ ...muted, fontSize: 13, lineHeight: 1.5, margin: 0 }}>{agents[0]?.description || "Task-focused assistant using this workspace's saved context."}</p>
                </div>
                <div style={panel}>
                  <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Execution status</h3>
                  <p style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px" }}>{tasks.filter(item => item.status === "succeeded").length}</p>
                  <p style={{ ...muted, fontSize: 12, margin: 0 }}>Completed tasks</p>
                  <p style={{ color: activeTasks ? "#d8c4ff" : "#86ddb5", fontSize: 12, margin: "12px 0 0" }}>{activeTasks ? "Background tasks are being monitored." : "No active tasks."}</p>
                </div>
                <div style={panel}>
                  <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Memory context</h3>
                  <p style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px" }}>{memories.length}</p>
                  <p style={{ ...muted, fontSize: 12, margin: 0 }}>Saved workspace memories</p>
                  <button type="button" onClick={() => setTab("memory")} style={{ ...button, marginTop: 12, width: "100%" }}>Open Memory</button>
                </div>
              </aside>
            </section>
          )}

          {tab === "memory" && (
            <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 16 }}>
              <div style={panel}>
                <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Workspace Memory</h2>
                <p style={{ ...muted, margin: "0 0 16px", fontSize: 13 }}>Persistent notes and decisions available as context to Agent tasks.</p>
                <div style={{ display: "grid", gap: 10 }}>
                  {!memories.length && <p style={muted}>No saved memories yet.</p>}
                  {memories.map(memory => (
                    <article key={memory.id} style={{ background: "#0c0e16", border: "1px solid #2c3041", borderRadius: 10, padding: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                        <strong style={{ fontSize: 12, color: "#b49aff" }}>{memory.category.replaceAll("_", " ")}</strong>
                        <span style={{ ...muted, fontSize: 11 }}>Importance {memory.importance}{memory.pinned ? " · Pinned" : ""}</span>
                      </div>
                      <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{memory.content}</p>
                    </article>
                  ))}
                </div>
              </div>
              <form onSubmit={saveMemory} style={{ ...panel, display: "grid", gap: 12, alignContent: "start" }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Save a memory</h3>
                <label style={{ fontSize: 12, ...muted }} htmlFor="memory-category">Category</label>
                <select id="memory-category" value={memoryCategory} onChange={event => setMemoryCategory(event.target.value)} style={{ background: "#0c0e16", border: "1px solid #393d52", borderRadius: 9, padding: 10, color: "#f5f3ff" }}>
                  <option value="project_context">Project context</option>
                  <option value="preference">Preference</option>
                  <option value="decision">Decision</option>
                  <option value="research_finding">Research finding</option>
                  <option value="standing_instruction">Standing instruction</option>
                  <option value="feedback">Feedback</option>
                </select>
                <label style={{ fontSize: 12, ...muted }} htmlFor="memory-content">Content</label>
                <textarea id="memory-content" value={memoryText} onChange={event => setMemoryText(event.target.value)} maxLength={12000} rows={7} required placeholder="Save a decision, preference, or useful project fact…" style={{ width: "100%", boxSizing: "border-box", background: "#0c0e16", border: "1px solid #393d52", borderRadius: 10, padding: 12, color: "#f5f3ff", font: "inherit" }} />
                <button disabled={savingMemory || !memoryText.trim()} type="submit" style={{ ...button, background: "#a98bf4", borderColor: "#a98bf4", color: "#171320", fontWeight: 800 }}>{savingMemory ? "Saving…" : "Save memory"}</button>
              </form>
            </section>
          )}

          {tab === "workflows" && (
            <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 16 }}>
              <div style={panel}>
                <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Workflow library</h2>
                <p style={{ ...muted, margin: "0 0 16px", fontSize: 13 }}>Create reusable, sequential Agent workflows. Each workflow is limited to six allowlisted steps.</p>
                <div style={{ display: "grid", gap: 10 }}>
                  {!workflows.length && <p style={muted}>No workflows created yet.</p>}
                  {workflows.map(workflow => <article key={workflow.id} style={{ background: "#0c0e16", border: "1px solid #2c3041", borderRadius: 10, padding: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><strong>{workflow.name}</strong><span style={{ ...muted, fontSize: 11 }}>{workflow.steps?.length ?? 0} steps</span></div>
                    <p style={{ ...muted, fontSize: 12, lineHeight: 1.5 }}>{workflow.description || "Sequential Agent workflow"}</p>
                    <p style={{ ...muted, fontSize: 11 }}>{workflow.trigger_type === "schedule" ? `Scheduled · every ${workflow.trigger_config?.interval ?? "unknown interval"} · ${workflow.enabled ? "active" : "paused"}` : "Manual workflow"}{workflow.next_run_at ? ` · next run ${new Date(workflow.next_run_at).toLocaleString()}` : ""}</p>
                    <ol style={{ paddingLeft: 20, marginBottom: 0, fontSize: 12, lineHeight: 1.7 }}>{workflow.steps?.map((step, index) => <li key={step.name + index}>{step.name}: {String(step.input?.prompt ?? step.tool)}</li>)}</ol>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}><button type="button" onClick={() => { setSelectedWorkflowId(workflow.id); setTab("chat"); }} style={button}>Use workflow</button>{workflow.trigger_type === "schedule" && <button type="button" onClick={() => void setWorkflowEnabled(workflow.id, !workflow.enabled)} style={button}>{workflow.enabled ? "Pause schedule" : "Resume schedule"}</button>}</div>
                  </article>)}
                </div>
              </div>
              <form onSubmit={createWorkflow} style={{ ...panel, display: "grid", gap: 12, alignContent: "start" }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Create workflow</h3>
                <label style={{ fontSize: 12, ...muted }} htmlFor="workflow-name">Workflow name</label>
                <input id="workflow-name" value={workflowName} onChange={event => setWorkflowName(event.target.value)} maxLength={160} required placeholder="Research and summarize" style={{ background: "#0c0e16", border: "1px solid #393d52", borderRadius: 9, padding: 10, color: "#f5f3ff" }} />
                <label style={{ fontSize: 12, ...muted }} htmlFor="workflow-schedule">Run schedule</label>
                <select id="workflow-schedule" value={scheduleInterval} onChange={event => setScheduleInterval(event.target.value as "manual" | "hourly" | "daily" | "weekly")} style={{ background: "#0c0e16", border: "1px solid #393d52", borderRadius: 9, padding: 10, color: "#f5f3ff" }}><option value="manual">Manual only</option><option value="hourly">Every hour</option><option value="daily">Every 24 hours</option><option value="weekly">Every 7 days</option></select>
                <label style={{ fontSize: 12, ...muted }} htmlFor="workflow-steps">Steps, one instruction per line (max 6)</label>
                <textarea id="workflow-steps" value={workflowStepsText} onChange={event => setWorkflowStepsText(event.target.value)} rows={8} maxLength={12000} required style={{ width: "100%", boxSizing: "border-box", background: "#0c0e16", border: "1px solid #393d52", borderRadius: 10, padding: 12, color: "#f5f3ff", font: "inherit" }} />
                <button type="submit" disabled={savingWorkflow || !workflowName.trim()} style={{ ...button, background: "#a98bf4", borderColor: "#a98bf4", color: "#171320", fontWeight: 800 }}>{savingWorkflow ? "Saving…" : "Save workflow"}</button>
                <p style={{ ...muted, fontSize: 11, lineHeight: 1.5, margin: 0 }}>Scheduled workflows enqueue a run automatically at the selected interval. You can pause or resume them from the library; at most five active schedules are allowed per user in this Workspace, and overlapping runs are held back. Agent tasks can use multilingual semantic Memory retrieval and read-only web research with source links. Memory writes always require approval.</p>
              </form>
            </section>
          )}

          {tab === "runs" && (
            <section style={panel}>
              <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Workflow execution history</h2>
              <p style={{ ...muted, margin: "0 0 16px", fontSize: 13 }}>Durable run and step records from Supabase, refreshed while tasks are active.</p>
              <div style={{ display: "grid", gap: 12 }}>
                {!workflowRuns.length && <p style={muted}>No workflow runs yet.</p>}
                {workflowRuns.map(run => <article key={run.id} style={{ background: "#0c0e16", border: "1px solid #2c3041", borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 13 }}>Run {run.id.slice(0, 8)}</strong>
                    <span style={{ color: run.status === "succeeded" ? "#86ddb5" : run.status === "failed" || run.status === "cancelled" ? "#ff9e9e" : "#d8c4ff", fontSize: 11, textTransform: "uppercase" }}>{run.status.replaceAll("_", " ")}</span>
                  </div>
                  <p style={{ ...muted, fontSize: 11 }}>Created {new Date(run.created_at).toLocaleString()} · Task {run.agent_task_id?.slice(0, 8) ?? "—"}</p>
                  <ol style={{ display: "grid", gap: 8, paddingLeft: 20, marginBottom: 0 }}>
                    {workflowStepRuns.filter(step => step.run_id === run.id).map(step => <li key={step.id} style={{ paddingLeft: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: 12 }}>{step.name}</strong><span style={{ ...muted, fontSize: 11 }}>{step.status.replaceAll("_", " ")}{step.requires_approval ? " · approval-gated" : ""}</span></div>
                      {step.error_code && <p style={{ color: "#ffaaaa", fontSize: 11 }}>{step.error_code}</p>}
                      {step.output && <pre style={{ color: "#c7c4d5", fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.5, fontFamily: "inherit" }}>{typeof step.output.result === "string" ? step.output.result : JSON.stringify(step.output.result ?? step.output, null, 2)}</pre>}
                    </li>)}
                  </ol>
                </article>)}
              </div>
            </section>
          )}
        </>
      )}
      <footer style={{ ...muted, marginTop: 22, fontSize: 11, lineHeight: 1.6 }}>
        Background execution runs up to six allowlisted steps. Memory writes require explicit approval. Arbitrary code, publishing, financial transactions and unrestricted external tools are not available.
      </footer>
    </main>
  );
}
