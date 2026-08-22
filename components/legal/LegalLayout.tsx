import Link from "next/link";
import type { ReactNode } from "react";

const LEGAL_LINKS = [
  { href: "/termos-de-uso", label: "Termos de Uso" },
  { href: "/privacidade", label: "Privacidade e LGPD" },
  { href: "/reembolso", label: "Cancelamento e reembolso" },
  { href: "/aviso-medico", label: "Aviso educacional" },
  { href: "/contato", label: "Contato e suporte" },
];

/** Bloco visualmente destacado para marcar um dado jurídico que ainda
 * precisa ser preenchido — nunca um valor inventado. */
export function FillIn({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-md border border-dashed border-[#ffb454]/60 bg-[#ffb454]/10 px-2 py-0.5 font-mono text-[13px] text-[#ffcf8a]">
      {children}
    </span>
  );
}

export function LegalLayout({
  title,
  updatedNote,
  children,
}: {
  title: string;
  updatedNote?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-[#061217] text-[#f4f8f8]">
      <header className="border-b border-white/10 px-5 py-5 sm:px-10">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold text-white">
            <span className="inline-block h-7 w-7 rounded-lg bg-gradient-to-br from-[#46d6c1] to-[#22aa98]" />
            SemioLab
          </Link>
          <Link href="/" className="text-xs font-semibold text-[#8da1a6] underline decoration-white/20 underline-offset-4 hover:text-white">
            Voltar ao início
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-10 sm:px-10 sm:py-14">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {updatedNote && <p className="mt-2 text-xs text-[#8da1a6]">{updatedNote}</p>}

        <div className="mt-4 rounded-xl border border-[#ffb454]/40 bg-[#ffb454]/10 px-4 py-3 text-xs leading-relaxed text-[#ffe0b0]">
          Este documento contém campos marcados como <FillIn>[preencher]</FillIn> que representam
          dados jurídicos reais (razão social, CNPJ/CPF, endereço, e-mail de suporte etc.) e
          precisam ser preenchidos por você antes da publicação — nenhum desses dados foi inventado.
        </div>

        <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-[#c4d3d5]">
          {children}
        </div>
      </article>

      <footer className="border-t border-white/10 px-5 py-8 sm:px-10">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#8da1a6]">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-white">
              {link.label}
            </Link>
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-3xl text-[11px] text-[#5c7176]">
          © {new Date().getFullYear()} SemioLab — <FillIn>[preencher: razão social]</FillIn>. Todos os direitos reservados.
        </p>
      </footer>
    </main>
  );
}

export { LEGAL_LINKS };
