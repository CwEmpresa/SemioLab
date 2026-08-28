"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignIn1 } from "@/components/ui/modern-stunning-sign-in";
import SplashScreen, { shouldSkipSplash } from "./splash-screen";
import IntroPresentation from "./intro-presentation";

type Stage = "splash" | "presentation" | "auth";

export default function LoginGate() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>(() => (shouldSkipSplash() ? "presentation" : "splash"));
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  if (stage === "splash") {
    return <SplashScreen onDone={() => setStage("presentation")} />;
  }
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
