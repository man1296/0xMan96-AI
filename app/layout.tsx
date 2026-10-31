import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "0xMan96 AI Platform",
  description: "Secure AI workspace and creator production platform.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body style={{ margin: 0, fontFamily: "Inter, ui-sans-serif, system-ui", background: "#090a10", color: "#f5f3ff" }}>{children}</body></html>;
}
