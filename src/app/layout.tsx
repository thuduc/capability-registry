import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GenAI Capability Registry",
  description: "Enterprise management, governance, and distribution of GenAI capability bundles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
