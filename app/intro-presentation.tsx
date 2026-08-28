"use client";

export default function IntroPresentation({
  onStart,
  onLogin,
}: {
  onStart: () => void;
  onLogin: () => void;
}) {
  return (
    <main className="intro-screen">
      <div className="intro-container">
        <div className="intro-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/onboarding/clinical-preview.webp" alt="" className="intro-hero-image" />
        </div>

        <div className="intro-copy">
          <small className="intro-eyebrow">TREINAMENTO CLÍNICO INTERATIVO</small>
          <h1>Treine hoje as decisões que a prática clínica vai exigir.</h1>
          <p>Converse com pacientes, realize exames e desenvolva seu raciocínio clínico em casos interativos e seguros.</p>
          <button className="primary intro-cta" onClick={onStart}>Experimentar um atendimento</button>
          <button className="intro-login-link" onClick={onLogin}>Já tenho uma conta</button>
        </div>
      </div>
    </main>
  );
}
