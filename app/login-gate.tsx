"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignIn1 } from "@/components/ui/modern-stunning-sign-in";
import SplashScreen, { SPLASH_STORAGE_KEY } from "./splash-screen";
import IntroPresentation from "./intro-presentation";

type Stage = "checking" | "splash" | "presentation" | "auth";

export default function LoginGate() {
  const router = useRouter();
  // "checking": mesmo estado no servidor e no 1º render do cliente — nunca
  // decide com base em localStorage antes da hidratação, evitando o
  // descompasso que fazia a splash nunca aparecer.
  const [stage, setStage] = useState<Stage>("checking");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    const seen = localStorage.getItem(SPLASH_STORAGE_KEY) === "1";
    const t = window.setTimeout(() => setStage(seen ? "presentation" : "splash"), 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    // Cada estágio é uma "página" nova — nunca herda posição de rolagem
    // do estágio anterior (ex.: clicar em "Já tenho uma conta" perto do
    // fim de uma apresentação rolada não pode deixar o login já rolado).
    window.scrollTo(0, 0);
  }, [stage]);

  if (stage === "checking") return <div className="onboarding-checking" aria-hidden />;
  if (stage === "splash") return <SplashScreen onDone={() => setStage("presentation")} />;
  if (stage === "presentation") {
    return (
      <IntroPresentation
        onStart={() => {
          // Sinaliza pro microcaso pular a própria introdução — a mesma
          // proposta já foi mostrada aqui, nunca duas vezes.
          sessionStorage.setItem("semiolab:skip-microcase-intro", "1");
          setAuthMode("signup");
          setStage("auth");
        }}
        onLogin={() => { setAuthMode("signin"); setStage("auth"); }}
      />
    );
  }
  return <SignIn1 onSignIn={() => router.refresh()} initialMode={authMode} />;
}
