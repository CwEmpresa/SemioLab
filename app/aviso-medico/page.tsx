import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { CircleAlert } from "lucide-react";

export const metadata: Metadata = { title: "Aviso Educacional — SemioLab" };

export default function AvisoMedicoPage() {
  return (
    <LegalLayout title="Aviso de Conteúdo Exclusivamente Educacional" updatedNote="Última atualização: [preencher com a data de publicação]">
      <div className="flex items-start gap-3 rounded-xl border border-[#ff9a9a]/40 bg-[#ff9a9a]/10 px-4 py-4 text-sm text-[#ffd4d4]">
        <CircleAlert className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <p>
          <b>O SemioLab é uma ferramenta de simulação educacional.</b> Nada no SemioLab constitui, substitui
          ou deve ser interpretado como diagnóstico médico, atendimento clínico, prescrição de
          medicamentos ou orientação profissional de saúde para qualquer pessoa real.
        </p>
      </div>

      <section>
        <h2 className="text-base font-bold text-white">1. O que é o SemioLab</h2>
        <p>
          O SemioLab é uma plataforma de estudo e treino de raciocínio clínico, destinada a estudantes e
          profissionais da área da saúde em formação. Todo o conteúdo — incluindo os casos clínicos, o
          &quot;Paciente Virtual&quot; e as respostas geradas por inteligência artificial — é{" "}
          <b>fictício e sintético</b>, criado exclusivamente para fins didáticos.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">2. O Paciente Virtual não é uma pessoa real</h2>
        <p>
          As respostas do Paciente Virtual são geradas por inteligência artificial a partir de um roteiro
          clínico pré-definido e fictício. A inteligência artificial pode cometer erros, ser imprecisa ou
          gerar respostas incoerentes. Os laudos de exames e a avaliação final também são gerados a
          partir de dados sintéticos ou de regras determinísticas, com finalidade didática — nunca
          diagnóstica.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">3. O SemioLab não substitui atendimento médico real</h2>
        <p>
          Se você, ou alguém que você conhece, estiver enfrentando um problema de saúde real — seja
          físico ou de saúde mental — procure atendimento médico ou psicológico profissional
          imediatamente. Não use o SemioLab, ou qualquer resposta gerada pela plataforma, como base para
          decisões de saúde reais, automedicação ou adiamento de atendimento médico necessário.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">4. Em caso de emergência</h2>
        <p>Se você estiver em uma emergência médica real, ligue imediatamente para os serviços de emergência:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>192</b> — SAMU (Serviço de Atendimento Móvel de Urgência)</li>
          <li><b>193</b> — Corpo de Bombeiros</li>
          <li><b>190</b> — Polícia Militar</li>
          <li><b>188</b> — CVV (Centro de Valorização da Vida), para apoio emocional e prevenção do suicídio, 24 horas</li>
        </ul>
        <p>Ou dirija-se ao pronto-socorro/UPA mais próximo.</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">5. A quem se destina</h2>
        <p>
          O SemioLab é destinado ao uso educacional supervisionado por estudantes e profissionais da
          área da saúde, como complemento — nunca substituto — à formação acadêmica e clínica
          formal, sob orientação de professores, preceptores e demais responsáveis pela formação do
          usuário.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">6. Aceite</h2>
        <p>
          Ao usar o SemioLab, você declara ter lido e compreendido este aviso, e concorda que utilizará
          a plataforma exclusivamente para fins de estudo e treino, nunca para obter orientação de saúde
          real para si ou para terceiros.
        </p>
      </section>
    </LegalLayout>
  );
}
