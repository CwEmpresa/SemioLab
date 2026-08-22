import type { Metadata } from "next";
import { LegalLayout, FillIn } from "@/components/legal/LegalLayout";

export const metadata: Metadata = { title: "Cancelamento e Reembolso — SemioLab" };

export default function ReembolsoPage() {
  return (
    <LegalLayout title="Política de Cancelamento e Reembolso" updatedNote="Última atualização: [preencher com a data de publicação]">
      <section>
        <h2 className="text-base font-bold text-white">1. Cancelamento da assinatura</h2>
        <p>
          Você pode cancelar sua assinatura do plano Pro a qualquer momento, pelo Perfil dentro do
          SemioLab ou diretamente no painel do parceiro de pagamentos (Cakto). Ao cancelar, você
          mantém acesso aos recursos Pro até o fim do período já pago (mensal ou anual), sem renovação
          automática subsequente.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">2. Direito de arrependimento (7 dias)</h2>
        <p>
          Conforme o art. 49 do Código de Defesa do Consumidor, compras feitas fora do estabelecimento
          comercial — incluindo pela internet — podem ser canceladas em até <b>7 (sete) dias corridos</b>{" "}
          a partir da contratação, com direito à devolução integral dos valores pagos, sem necessidade
          de justificativa. Para exercer esse direito, entre em contato pelo e-mail{" "}
          <FillIn>[preencher: e-mail de suporte]</FillIn> informando o e-mail da sua conta.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">3. Reembolso fora do prazo de arrependimento</h2>
        <p>
          <FillIn>
            [preencher: definir aqui a política de reembolso após os 7 dias legais — por exemplo, se
            reembolsos proporcionais são oferecidos em casos específicos, ou se após esse prazo a
            assinatura não é mais reembolsável, mantendo-se apenas o cancelamento da renovação futura]
          </FillIn>
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">4. Como o reembolso é processado</h2>
        <p>
          Reembolsos aprovados são processados pelo parceiro de pagamentos (Cakto) e devolvidos pelo
          mesmo meio utilizado na compra. O prazo para o valor aparecer no seu extrato pode variar
          conforme a instituição financeira e a forma de pagamento utilizada,{" "}
          <FillIn>[preencher: prazo estimado, se desejar informar]</FillIn>.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">5. Cobranças recusadas ou contestadas (chargeback)</h2>
        <p>
          Em caso de estorno da operadora do cartão (chargeback) ou reembolso solicitado diretamente à
          Cakto, o acesso ao plano Pro é revogado automaticamente assim que o parceiro de pagamentos
          confirma o evento, podendo a conta retornar ao plano gratuito ou de teste conforme aplicável.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">6. Período de teste gratuito</h2>
        <p>
          O período de teste gratuito não envolve cobrança e pode ser interrompido a qualquer momento
          sem qualquer ônus, simplesmente não assinando um plano pago ao final do período.
        </p>
      </section>

      <section>
        <h2 className="text-base font-bold text-white">7. Dúvidas sobre cobranças</h2>
        <p>
          Para dúvidas sobre uma cobrança específica, cancelamento ou reembolso, entre em contato pelo
          e-mail <FillIn>[preencher: e-mail de suporte]</FillIn> ou pela nossa{" "}
          <a href="/contato" className="underline hover:text-white">página de Contato e Suporte</a>.
        </p>
      </section>
    </LegalLayout>
  );
}
