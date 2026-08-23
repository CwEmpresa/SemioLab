import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SemioLab",
  description: "Estude, pratique e evolua em Semiologia Médica.",
  other: { "codex-preview": "development" },
  icons: { icon: "/semiolab-fox.png", apple: "/icon-192.png" },
  manifest: "/manifest.json",
};
export const viewport = { themeColor: "#061217" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preload" as="image" href="/semiolab-pro-fox.webp" type="image/webp" />
      </head>
      <body>{children}</body>
    </html>
  );
}
