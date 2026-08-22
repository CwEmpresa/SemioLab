import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = { title: "Privacidade e LGPD — SemioLab" };

export default function PrivacidadePage() {
  return (
    <LegalLayout title="Política de Privacidade e LGPD" updatedNote="Última atualização: 22 de agosto de 2026">
      <section>
        <p>
          Esta Política de Privacidade explica como o SemioLab (&quot;nós&quot;), com sede em São
          Luís, Maranhão, Brasil, coleta, usa, armazena e protege os dados pessoais dos usuários da
          plataforma, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 —
          LGPD).
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">1. Dados que coletamos</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Dados de cadastro:</b> nome, e-mail e senha (armazenada de forma criptografada).</li>
          <li><b>Dados de uso:</b> progresso em quizzes, XP, sequência de estudo (streak), histórico de atendimentos ao Paciente Virtual, respostas e mensagens trocadas durante as simulações.</li>
          <li><b>Dados de pagamento:</b> quando você assina um plano pago, dados de cobrança são processados diretamente pelo parceiro de pagamentos (atualmente a Cakto); o SemioLab não armazena dados completos de cartão de crédito.</li>
          <li><b>Dados de voz (recurso Pro):</b> áudio gravado para transcrição de perguntas ao Paciente Virtual é processado para gerar o texto da pergunta e não é armazenado permanentemente pelo SemioLab após o processamento.</li>
          <li><b>Dados técnicos:</b> informações de uso da plataforma necessárias ao seu funcionamento (ex.: registros de acesso para cálculo de sequência de estudo).</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">2. Base legal e finalidade do tratamento</h2>
        <p>
          Tratamos seus dados pessoais com base na execução do contrato firmado com você (fornecimento
          do serviço), no consentimento (quando aplicável, por exemplo para comunicações de marketing)
          e no legítimo interesse (por exemplo, segurança e melhoria da plataforma), nos termos do
          art. 7º da LGPD. As finalidades incluem: viabilizar seu acesso e uso da plataforma,
          personalizar sua experiência de estudo, processar pagamentos, oferecer suporte e cumprir
          obrigações legais e regulatórias.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">3. Compartilhamento de dados</h2>
        <p>Compartilhamos dados pessoais apenas com terceiros estritamente necessários à operação do serviço, entre eles:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Supabase</b> — provedor de banco de dados e autenticação que hospeda os dados da plataforma;</li>
          <li><b>OpenAI</b> — provedor de inteligência artificial usado para gerar as respostas do Paciente Virtual, transcrição de voz e síntese de voz; mensagens trocadas durante as simulações são enviadas a esse provedor para processamento;</li>
          <li><b>Cakto</b> — parceiro de processamento de pagamentos, para viabilizar assinaturas pagas.</li>
        </ul>
        <p>
          Não vendemos dados pessoais a terceiros. Alguns desses provedores podem processar dados fora
          do território brasileiro; nesses casos, buscamos assegurar salvaguardas compatíveis com a
          LGPD.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">4. Retenção e exclusão de dados</h2>
        <p>
          Mantemos seus dados pessoais pelo tempo necessário ao cumprimento das finalidades descritas
          nesta política, ou conforme exigido por lei. Ao solicitar o encerramento da sua conta, seus
          dados de identificação serão removidos ou anonimizados, ressalvadas informações que devamos
          reter por obrigação legal (por exemplo, registros fiscais de pagamento).
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">5. Seus direitos como titular de dados</h2>
        <p>Nos termos do art. 18 da LGPD, você tem direito a:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Confirmar a existência de tratamento de dados;</li>
          <li>Acessar seus dados pessoais;</li>
          <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
          <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a lei;</li>
          <li>Solicitar a portabilidade dos dados;</li>
          <li>Revogar o consentimento e solicitar a eliminação dos dados tratados com base nele;</li>
          <li>Obter informações sobre as entidades com quem seus dados foram compartilhados.</li>
        </ul>
        <p>
          Para exercer qualquer desses direitos, entre em contato pelo e-mail{" "}
          <a href="mailto:suporte.semiolab@gmail.com" className="underline hover:text-white">suporte.semiolab@gmail.com</a>{" "}
          — respondemos em até 3 dias úteis.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">6. Segurança da informação</h2>
        <p>
          Adotamos medidas técnicas e administrativas razoáveis para proteger seus dados pessoais
          contra acessos não autorizados, perda, alteração ou divulgação indevida, incluindo
          criptografia de senhas e controle de acesso por conta (Row Level Security), que impede que um
          usuário acesse dados de outro.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">7. Cookies e tecnologias similares</h2>
        <p>
          O SemioLab utiliza apenas cookies estritamente necessários ao funcionamento da plataforma,
          como manutenção da sua sessão autenticada. Nenhum cookie de rastreamento ou publicidade é
          utilizado.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">8. Encarregado de Proteção de Dados (DPO)</h2>
        <p>
          Você pode entrar em contato com nosso Encarregado de Proteção de Dados pelo e-mail{" "}
          <a href="mailto:suporte.semiolab@gmail.com" className="underline hover:text-white">suporte.semiolab@gmail.com</a>{" "}
          para quaisquer questões relacionadas ao tratamento de dados pessoais nos termos da LGPD.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">9. Alterações desta política</h2>
        <p>
          Podemos atualizar esta Política de Privacidade periodicamente. Alterações relevantes serão
          comunicadas por e-mail ou por aviso na plataforma.
        </p>
      </section>
    </LegalLayout>
  );
}
