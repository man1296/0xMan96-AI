"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const redirectTo = new URL("/auth/callback", window.location.origin).toString();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo }
      });
      if (authError) throw authError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} style={{ display: "grid", gap: 14, marginTop: 24 }}>
    <label htmlFor="email" style={{ color: "#b7b6c6" }}>Email address</label>
    <input id="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 14, borderRadius: 10, background: "#141620", color: "white", border: "1px solid #37394a" }} />
    <button disabled={busy || sent} style={{ padding: 14, border: 0, borderRadius: 10, background: "#a98bf4", color: "#15121d", fontWeight: 700 }}>{busy ? "Sending…" : sent ? "Check your email" : "Send secure sign-in link"}</button>
    {sent && <p role="status" style={{ color: "#b7b6c6" }}>If the address is eligible, a sign-in link has been sent. Check your inbox.</p>}
    {error && <p role="alert" style={{ color: "#ff9b9b" }}>{error}</p>}
  </form>;
}
