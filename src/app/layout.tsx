import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fiat402",
  description: "x402 protocol middleware — Stripe microbilling for AI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
