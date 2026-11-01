import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/workspace");

  return (
    <main style={{ maxWidth: 820, margin: "12vh auto", padding: 24 }}>
      <p style={{ color: "#aa91f4", letterSpacing: 3, fontSize: 12 }}>0XMAN96 / AI WORKSPACE</p>
      <h1 style={{ fontSize: "clamp(38px, 8vw, 64px)", lineHeight: 1.05, marginBottom: 12 }}>
        One Agent. <span style={{ color: "#aa91f4" }}>One workspace.</span>
      </h1>
      <p style={{ color: "#a5a5b4", lineHeight: 1.7, maxWidth: 640 }}>
        Plan and run bounded tasks, keep persistent project Memory, build reusable Workflows, and review every execution step in one authenticated workspace.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
        <Link href="/login" style={{ display: "inline-block", padding: "13px 18px", borderRadius: 10, background: "#a98bf4", color: "#171320", fontWeight: 800, textDecoration: "none" }}>
          Open secure workspace
        </Link>
        <a href="https://man1296.github.io/0xMan96-AI/" style={{ display: "inline-block", padding: "13px 18px", borderRadius: 10, border: "1px solid #37394a", color: "#d5d2e2", textDecoration: "none" }}>
          Legacy workspace
        </a>
      </div>
      <p style={{ color: "#777887", fontSize: 12, marginTop: 28 }}>
        Backend health: <a href="/api/health" style={{ color: "#c5b4ff" }}>/api/health</a>
      </p>
    </main>
  );
}
