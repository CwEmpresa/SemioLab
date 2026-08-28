"use client";

import { MessageCircle, Scan, Activity, Mic, ArrowUp, Maximize2 } from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";

export default function IntroPresentation({
  onStart,
  onLogin,
}: {
  onStart: () => void;
  onLogin: () => void;
}) {
  return (
    <main className="intro-presentation">
      <div className="intro-visual">
        <BlurFade delay={0.05} className="intro-card intro-card-chat">
          <header><i><MessageCircle size={13} /></i><span>Paciente</span></header>
          <p className="intro-bubble">Estou com falta de ar e um aperto no peito que começou esta manhã.</p>
          <div className="intro-typing"><i /><i /><i /></div>
          <div className="intro-input"><Mic size={14} /><span>Escreva sua resposta...</span><i className="intro-send"><ArrowUp size={14} /></i></div>
        </BlurFade>

        <BlurFade delay={0.18} className="intro-card intro-card-xray">
          <header><i><Scan size={13} /></i><span>Raio-X de Tórax</span><Maximize2 size={13} className="intro-card-corner" /></header>
          <div className="intro-xray-mock">
            <svg viewBox="0 0 100 90" preserveAspectRatio="xMidYMid meet">
              <ellipse cx="50" cy="42" rx="34" ry="30" fill="none" stroke="#5fb9c9" strokeOpacity=".55" strokeWidth="1.4" />
              <path d="M50 14 v56 M30 24 Q22 44 30 62 M70 24 Q78 44 70 62" fill="none" stroke="#8fd7e2" strokeOpacity=".5" strokeWidth="1.1" />
            </svg>
          </div>
        </BlurFade>

        <BlurFade delay={0.3} className="intro-card intro-card-auscultation">
          <header><i><Activity size={13} /></i><span>Ausculta Cardíaca</span><em className="intro-rec">Gravando...</em></header>
          <svg className="intro-waveform" viewBox="0 0 220 60" preserveAspectRatio="none">
            <polyline
              fill="none" stroke="#46d6c1" strokeWidth="1.6"
              points="0,30 20,30 26,10 32,50 38,30 70,30 76,14 82,46 88,30 130,30 136,8 142,52 148,30 220,30"
            />
          </svg>
          <small>Foco: Área Aórtica</small>
        </BlurFade>
      </div>

      <div className="intro-copy">
        <BlurFade delay={0.42}><small className="intro-eyebrow">TREINAMENTO CLÍNICO INTERATIVO</small></BlurFade>
        <BlurFade delay={0.52}><h1>Treine hoje as decisões que a prática clínica vai exigir.</h1></BlurFade>
        <BlurFade delay={0.62}><p>Converse com pacientes, realize exames e desenvolva seu raciocínio clínico em casos interativos e seguros.</p></BlurFade>
        <BlurFade delay={0.74}>
          <button className="primary intro-cta" onClick={onStart}>Experimentar um atendimento</button>
          <button className="intro-login-link" onClick={onLogin}>Já tenho uma conta</button>
        </BlurFade>
      </div>
    </main>
  );
}
