import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { Mail, MapPin, Clock, MessageCircle } from "lucide-react";

export const metadata: Metadata = { title: "Contato e Suporte — SemioLab" };

export default function ContatoPage() {
  return (
    <LegalLayout title="Contato e Suporte" updatedNote="Última atualização: 22 de agosto de 2026">
      <p>
        Estamos por aqui para ajudar com dúvidas sobre sua conta, assinatura, ou qualquer questão sobre
        o uso do SemioLab.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Mail className="h-4 w-4 text-[#65e5d0]" /> E-mail de suporte
          </div>
          <p className="mt-2 text-sm">
            <a href="mailto:suporte.semiolab@gmail.com" className="underline hover:text-white">suporte.semiolab@gmail.com</a>
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Clock className="h-4 w-4 text-[#65e5d0]" /> Prazo de atendimento
          </div>
          <p className="mt-2 text-sm">Respondemos em até 3 dias úteis.</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <MapPin className="h-4 w-4 text-[#65e5d0]" /> Responsável
          </div>
          <p className="mt-2 text-sm">
            SemioLab
            <br />
            São Luís, Maranhão, Brasil
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <MessageCircle className="h-4 w-4 text-[#65e5d0]" /> Feedback pelo app
          </div>
          <p className="mt-2 text-sm">
            Se você já tem uma conta, também pode enviar feedback direto pelo Perfil, em &quot;Preferências
            e suporte&quot;.
          </p>
        </div>
      </div>

      <section>
        <h2 className="text-base font-bold text-white">O que podemos ajudar</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Dúvidas sobre planos, cobrança, cancelamento ou reembolso;</li>
          <li>Problemas técnicos ou de acesso à conta;</li>
          <li>Dúvidas sobre privacidade e uso de dados (veja também nossa{" "}
            <a href="/privacidade" className="underline hover:text-white">Política de Privacidade</a>);</li>
          <li>Sugestões de melhoria e relato de erros no conteúdo educacional.</li>
        </ul>
      </section>

      <p className="text-xs text-[#8da1a6]">
        Este canal não é destinado a dúvidas médicas reais. Em caso de emergência, veja o nosso{" "}
        <a href="/aviso-medico" className="underline hover:text-white">Aviso de Conteúdo Educacional</a>.
      </p>
    </LegalLayout>
  );
}
