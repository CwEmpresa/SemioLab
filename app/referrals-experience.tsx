"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Gift, Share2, Sparkles } from "lucide-react";

type Invited = { name: string; joinedAt: string; qualified: boolean };
type ReferralsData = {
  code: string;
  shareUrl: string;
  invited: Invited[];
  qualifiedCount: number;
  progressToNext: number;
  rewardsGranted: number;
  proGrantedUntil: string | null;
};

export default function ReferralsExperience() {
  const [data, setData] = useState<ReferralsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  async function share() {
    if (!data) return;
    const text = "Estudo semiologia e clínica com o SemioLab — entra com meu link e a gente evolui junto:";
    if (navigator.share) {
      try {
        await navigator.share({ title: "SemioLab", text, url: data.shareUrl });
        return;
      } catch {
        // Cancelado pela pessoa — cai pro fallback de copiar, sem erro.
      }
    }
    await copyLink();
  }

  async function copyLink() {
    if (!data) return;
    await navigator.clipboard.writeText(data.shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="page referrals-page">
        <div className="referrals-skeleton" aria-hidden />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="page referrals-page">
        <p className="referrals-error">Não foi possível carregar seu link de indicação agora. Tente de novo em instantes.</p>
      </div>
    );
  }

  const remaining = data.progressToNext === 0 ? 3 : 3 - data.progressToNext;

  return (
    <div className="page referrals-page">
      <header className="referrals-hero">
        <span className="referrals-hero-icon"><Gift /></span>
        <h1>Indique e ganhe 1 mês de Pro</h1>
        <p>
          Convide amigos com seu link. Quando 3 deles se cadastrarem e usarem o SemioLab por pelo menos 3 dias
          (dentro de 7 dias do cadastro), você ganha 1 mês de Pro de graça — e pode repetir quantas vezes quiser.
        </p>
      </header>

      <section className="referrals-link-card">
        <span className="referrals-link-label">Seu link</span>
        <div className="referrals-link-row">
          <code>{data.shareUrl}</code>
          <button className="referrals-copy" onClick={copyLink} aria-label="Copiar link">
            {copied ? <Check /> : <Copy />}
          </button>
        </div>
        <button className="referrals-share" onClick={share}>
          <Share2 /> Compartilhar convite
        </button>
      </section>

      <section className="referrals-progress-card">
        <div className="referrals-progress-head">
          <span>Progresso para o próximo mês grátis</span>
          <b>{remaining === 3 ? "0" : 3 - remaining} de 3</b>
        </div>
        <div className="referrals-progress-bar">
          <i style={{ width: `${((3 - remaining) / 3) * 100}%` }} />
        </div>
        {data.rewardsGranted > 0 && (
          <p className="referrals-rewards-note">
            <Sparkles /> Você já ganhou {data.rewardsGranted} {data.rewardsGranted === 1 ? "mês" : "meses"} de Pro por indicação.
          </p>
        )}
        {data.proGrantedUntil && new Date(data.proGrantedUntil).getTime() > Date.now() && (
          <p className="referrals-rewards-note">
            Seu Pro por indicação vale até {new Date(data.proGrantedUntil).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}.
          </p>
        )}
      </section>

      <section className="referrals-list-card">
        <h2>Quem você já indicou</h2>
        {data.invited.length === 0 ? (
          <p className="referrals-empty">Ninguém ainda — compartilhe seu link acima para começar.</p>
        ) : (
          <ul className="referrals-list">
            {data.invited.map((person, i) => (
              <li key={i}>
                <span className="referrals-list-name">{person.name}</span>
                <span className={`referrals-badge ${person.qualified ? "qualified" : "pending"}`}>
                  {person.qualified ? "Ativo" : "Aguardando 3 dias de uso"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
