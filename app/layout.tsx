import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LangLens — Your screen, in your language",
  description: "Real-time AI translation of everything on your screen. Any app. Any language. Live.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
