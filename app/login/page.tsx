import Link from "next/link";
import LoginForm from "./login-form";

export default function LoginPage() {
  return <main style={{ maxWidth: 520, margin: "12vh auto", padding: 24 }}>
    <p style={{ color: "#aa91f4", letterSpacing: 3, fontSize: 12 }}>ACCOUNT ACCESS</p>
    <h1>Connect your workspace</h1>
    <p style={{ color: "#a5a5b4", lineHeight: 1.7 }}>Use a passwordless email sign-in link. Your session is managed with secure Supabase server-side cookies.</p>
    <LoginForm />
    <p style={{ marginTop: 24 }}><Link href="/" style={{ color: "#c5b4ff" }}>Return to platform status</Link></p>
  </main>;
}
