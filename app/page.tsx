export default function Home() {
  return (
    <main style={{ maxWidth: 760, margin: "12vh auto", padding: 24 }}>
      <p style={{ color: "#aa91f4", letterSpacing: 3, fontSize: 12 }}>0xMAN96 / PLATFORM FOUNDATION</p>
      <h1 style={{ fontSize: "clamp(38px, 8vw, 64px)", lineHeight: 1.05, marginBottom: 12 }}>Ideas in.<br /><span style={{ color: "#aa91f4" }}>Momentum out.</span></h1>
      <p style={{ color: "#a5a5b4", lineHeight: 1.7 }}>The secure backend foundation is being provisioned. The existing GitHub Pages workspace remains available while authentication, database and provider services are connected.</p>
      <p><a href="https://man1296.github.io/0xMan96-AI/" style={{ color: "#c5b4ff" }}>Open existing workspace →</a></p>
      <p style={{ color: "#777887", fontSize: 12 }}>Backend health: <a href="/api/health" style={{ color: "#c5b4ff" }}>/api/health</a></p>
    </main>
  );
}
