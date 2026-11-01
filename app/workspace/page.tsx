import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AgentWorkspace from "./agent-workspace";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id,name")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !workspace) {
    return (
      <main style={{ maxWidth: 760, margin: "10vh auto", padding: 24 }}>
        <p style={{ color: "#b49aff", letterSpacing: 3, fontSize: 12 }}>0XMAN96 / WORKSPACE</p>
        <h1>Workspace unavailable</h1>
        <p style={{ color: "#a5a5b4", lineHeight: 1.7 }}>
          Your account is authenticated, but no accessible workspace was found. Check the workspace membership and signup provisioning configuration.
        </p>
      </main>
    );
  }

  return <AgentWorkspace workspaceId={workspace.id} workspaceName={workspace.name} userEmail={user.email ?? user.id} />;
}
