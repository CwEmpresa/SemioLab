import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";
import "./study.css";
import "./research.css";

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
        {/* Fonte via <link>: um @import no CSS vinha depois das regras do
            Tailwind e era ignorado pelo navegador em produção. A regra
            no-page-custom-font é do Pages Router; no layout raiz do App
            Router a fonte já vale para todas as páginas. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
