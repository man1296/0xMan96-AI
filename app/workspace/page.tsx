import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <main style={{ maxWidth: 760, margin: "10vh auto", padding: 24 }}>
    <p style={{ color: "#aa91f4", letterSpacing: 3, fontSize: 12 }}>AUTHENTICATED WORKSPACE</p>
    <h1>Welcome to 0xMan96 AI</h1>
    <p style={{ color: "#a5a5b4" }}>Signed in as {user.email ?? user.id}. Workspace UI migration is staged separately from the existing GitHub Pages app.</p>
  </main>;
}
