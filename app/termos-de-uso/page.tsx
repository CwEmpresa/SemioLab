import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = { title: "Termos de Uso — SemioLab" };

export default function TermosDeUsoPage() {
  return (
    <LegalLayout title="Termos de Uso" updatedNote="Última atualização: 22 de agosto de 2026">
      <section>
        <h2 className="text-base font-bold text-white">1. Sobre o SemioLab</h2>
        <p>
          O SemioLab é uma plataforma educacional voltada ao ensino e à prática de semiologia médica,
          oferecendo simulados, um atlas de conteúdo clínico e um &quot;Paciente Virtual&quot; — uma
          simulação de atendimento gerada por inteligência artificial para fins exclusivamente
          didáticos. O SemioLab é operado a partir de São Luís, Maranhão, Brasil
          (&quot;SemioLab&quot;, &quot;nós&quot;).
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">2. Aceitação dos termos</h2>
        <p>
          Ao criar uma conta ou usar o SemioLab, você declara ter lido, compreendido e aceitado
          integralmente estes Termos de Uso e a nossa{" "}
          <a href="/privacidade" className="underline hover:text-white">Política de Privacidade</a>.
          Se você não concorda com qualquer parte destes termos, não utilize a plataforma.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">3. Cadastro e conta</h2>
        <p>
          Para usar o SemioLab é necessário criar uma conta com e-mail válido. Você é responsável por
          manter a confidencialidade da sua senha e por todas as atividades realizadas na sua conta.
          O SemioLab destina-se a estudantes e profissionais da área da saúde, ou pessoas em processo
          de formação nessa área; ao se cadastrar, você declara ter capacidade civil para contratar ou
          possuir autorização de seu responsável legal, conforme a legislação brasileira.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">4. Planos, assinatura e pagamento</h2>
        <p>
          O SemioLab oferece um período de teste gratuito e planos pagos (&quot;Pro&quot;), mensal ou
          anual, com recursos adicionais como atendimentos ilimitados ao Paciente Virtual e recursos de
          voz. Os pagamentos são processados por um parceiro de pagamentos terceirizado (atualmente a
          Cakto). Ao assinar um plano pago, você concorda com os valores e condições apresentados no
          momento da contratação. Consulte nossa{" "}
          <a href="/reembolso" className="underline hover:text-white">Política de Cancelamento e Reembolso</a>{" "}
          para detalhes sobre cancelamento e devolução de valores.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">5. Natureza educacional — leia com atenção</h2>
        <p>
          O SemioLab é uma ferramenta de simulação e treino, incluindo pacientes fictícios e conteúdo
          gerado por inteligência artificial. Nada no SemioLab constitui diagnóstico médico,
          prescrição, orientação clínica ou substituto de atendimento profissional real. Veja o{" "}
          <a href="/aviso-medico" className="underline hover:text-white">Aviso de Conteúdo Educacional</a>{" "}
          para o texto completo desse aviso, que é parte integrante destes Termos.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">6. Uso aceitável</h2>
        <p>Ao usar o SemioLab, você concorda em não:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Utilizar a plataforma para fins ilegais ou não autorizados;</li>
          <li>Tentar contornar limites técnicos, de segurança ou de uso da plataforma;</li>
          <li>Reproduzir, revender ou redistribuir o conteúdo do SemioLab sem autorização;</li>
          <li>Utilizar o Paciente Virtual ou qualquer recurso de IA para obter orientação médica real destinada a uma pessoa de verdade;</li>
          <li>Enviar conteúdo ofensivo, ilegal ou que viole direitos de terceiros.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">7. Propriedade intelectual</h2>
        <p>
          Todo o conteúdo do SemioLab — incluindo textos, casos clínicos, design, marca e software — é
          de propriedade do SemioLab ou de seus licenciadores, e é protegido pela legislação de
          direitos autorais e propriedade intelectual aplicável. O uso da plataforma não transfere
          nenhum direito de propriedade intelectual ao usuário.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">8. Limitação de responsabilidade</h2>
        <p>
          O SemioLab é fornecido &quot;como está&quot;. Na máxima extensão permitida pela lei, não nos
          responsabilizamos por decisões clínicas reais tomadas com base no conteúdo da plataforma, nem
          por indisponibilidades temporárias do serviço. Nada nesta cláusula limita direitos do
          consumidor previstos em lei.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">9. Alterações destes termos</h2>
        <p>
          Podemos atualizar estes Termos periodicamente. Alterações relevantes serão comunicadas por
          e-mail ou por aviso na plataforma. O uso continuado do SemioLab após uma alteração significa
          que você concorda com os novos termos.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">10. Encerramento de conta</h2>
        <p>
          Você pode encerrar sua conta a qualquer momento pelo Perfil. Podemos suspender ou encerrar
          contas que violem estes Termos, mediante aviso quando possível.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">11. Lei aplicável e foro</h2>
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da
          comarca de São Luís, Maranhão, para dirimir eventuais controvérsias, ressalvado o foro do
          domicílio do consumidor quando aplicável por lei.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">12. Contato</h2>
        <p>
          Dúvidas sobre estes Termos podem ser enviadas para{" "}
          <a href="mailto:suporte.semiolab@gmail.com" className="underline hover:text-white">suporte.semiolab@gmail.com</a>{" "}
          — respondemos em até 3 dias úteis. Veja também nossa{" "}
          <a href="/contato" className="underline hover:text-white">página de Contato e Suporte</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
