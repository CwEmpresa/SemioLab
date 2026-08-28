"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignIn1 } from "@/components/ui/modern-stunning-sign-in";
import SplashScreen from "./splash-screen";
import IntroPresentation from "./intro-presentation";
import SemioLab from "./semiolab";
// Captura beforeinstallprompt o mais cedo possível — este é o primeiro
// componente cliente que sempre monta, antes até da splash. Só o import
// já dispara a captura (efeito colateral no módulo).
import "./pwa-install-prompt";

const INTRO_KEY = "semiolab:intro-completed:v1";

type Dest = "pending" | "presentation" | "auth" | "app";

export default function AppGate({
  authenticated,
  profileComplete = true,
}: {
  authenticated: boolean;
  profileComplete?: boolean;
}) {
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);
  // Autenticado: o servidor já resolveu tudo (page.tsx), decide na hora,
  // sem esperar nenhum efeito — nunca mostra apresentação/login por engano.
  // Deslogado: só decide depois de checar a chave local (client-only).
  const [dest, setDest] = useState<Dest>(() => (authenticated ? "app" : "pending"));
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    if (authenticated) return;
    const seen = localStorage.getItem(INTRO_KEY) === "1";
    const t = window.setTimeout(() => setDest(seen ? "auth" : "presentation"), 0);
    return () => window.clearTimeout(t);
  }, [authenticated]);

  useEffect(() => {
    // Perfil incompleto: reaproveita o deep-link ?screen= que o próprio
    // Root já entende (mesmo mecanismo dos links de notificação) — nunca
    // cria tela nova, nunca altera visual.
    if (authenticated && !profileComplete && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("screen") !== "profile") {
        params.set("screen", "profile");
        window.history.replaceState({}, "", `/?${params.toString()}`);
      }
    }
  }, [authenticated, profileComplete]);

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }
  if (dest === "pending") {
    // Animação terminou mas a decisão (chave local) ainda não — nunca
    // mostra apresentação/login/dashboard errado nesse meio-tempo.
    return <div className="onboarding-checking" aria-hidden />;
  }
  if (dest === "app") {
    // Autenticado sempre vence a chave local. O próprio Root (SemioLab)
    // já decide internamente microcaso-pendente vs. Dashboard.
    return <SemioLab />;
  }
  if (dest === "presentation") {
    return (
      <IntroPresentation
        onStart={() => {
          localStorage.setItem(INTRO_KEY, "1");
          sessionStorage.setItem("semiolab:skip-microcase-intro", "1");
          setAuthMode("signup");
          setDest("auth");
        }}
        onLogin={() => {
          localStorage.setItem(INTRO_KEY, "1");
          setAuthMode("signin");
          setDest("auth");
        }}
      />
    );
  }
  return <SignIn1 onSignIn={() => router.refresh()} initialMode={authMode} />;
}
