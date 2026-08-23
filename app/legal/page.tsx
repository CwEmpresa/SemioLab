import type { Metadata } from "next";
import { LegalLayout, LEGAL_LINKS } from "@/components/legal/LegalLayout";

export const metadata: Metadata = { title: "Termos, Privacidade e Informações Legais — SemioLab" };

export default function LegalHubPage() {
  return (
    <LegalLayout title="Termos, Privacidade e Informações Legais">
      <p>Central com todas as informações legais do SemioLab. Escolha o que você quer ler:</p>
      <ul className="list-disc space-y-2 pl-5">
        {LEGAL_LINKS.map((link) => (
          <li key={link.href}>
            <a href={link.href} className="underline hover:text-white">{link.label}</a>
          </li>
        ))}
      </ul>
    </LegalLayout>
  );
}
