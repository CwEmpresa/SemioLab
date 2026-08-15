"use client";

import * as React from "react";
import {
  ArrowRight,
  BookOpenCheck,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
} from "lucide-react";

type SignIn1Props = {
  onSignIn?: () => void;
};

const SignIn1 = ({ onSignIn }: SignIn1Props) => {
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSignIn = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!email || !password || (mode === "signup" && (!name || !confirmPassword))) {
      setError("Informe seu e-mail e sua senha.");
      return;
    }
    if (!validateEmail(email)) {
      setError("Informe um endereço de e-mail válido.");
      return;
    }

    if (mode === "signup" && password.length < 6) {
      setError("Crie uma senha com pelo menos 6 caracteres.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setError("");
    setBusy(true);
    window.setTimeout(() => {
      if (mode === "signup") {
        window.localStorage.setItem("semiolab-local-account", JSON.stringify({ name, email }));
      }
      onSignIn?.();
    }, 450);
  };

  const switchMode = () => {
    setMode((current) => current === "signin" ? "signup" : "signin");
    setError("");
  };

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#041216] px-4 py-5 font-sans text-white sm:px-6 sm:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(53,201,177,0.22),transparent_32%),radial-gradient(circle_at_86%_85%,rgba(29,137,122,0.18),transparent_31%),linear-gradient(145deg,#041216,#08272c_52%,#06231f)]" />
      <div className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full border border-[#6ee7d2]/10 shadow-[0_0_0_80px_rgba(53,201,177,0.025),0_0_0_160px_rgba(53,201,177,0.018)]" />
      <div className="pointer-events-none absolute -bottom-44 -right-36 h-96 w-96 rounded-full border border-[#6ee7d2]/10 shadow-[0_0_0_80px_rgba(53,201,177,0.025),0_0_0_160px_rgba(53,201,177,0.018)]" />

      <img
        src="/semiolab-wordmark.png"
        alt="SemioLab"
        className="absolute left-5 top-4 z-10 h-auto w-32 object-contain sm:left-8 sm:top-7 sm:w-40"
      />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <section className="w-full rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.11] via-white/[0.055] to-white/[0.025] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:p-8">
          <div className="mb-5 flex flex-col items-center text-center sm:mb-6">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#6ee7d2]/20 bg-[#00110d]/80 p-2.5 shadow-[0_12px_35px_rgba(53,201,177,0.2)] sm:h-[4.5rem] sm:w-[4.5rem]">
              <img
                src="/semiolab-fox.png"
                alt="Símbolo do SemioLab"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="mb-2 text-[10px] font-extrabold tracking-[0.22em] text-[#65e5d0]">
              {mode === "signin" ? "BEM-VINDO" : "COMECE AGORA"}
            </span>
            <h1 className="text-balance text-[1.75rem] font-semibold leading-none tracking-[-0.045em] text-white sm:text-4xl">
              {mode === "signin" ? "Entre no SemioLab" : "Crie sua conta grátis"}
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-6 text-[#a9bec2]">
              {mode === "signin" ? "Transforme estudo diário em raciocínio clínico de verdade." : "Tenha seu espaço de estudo, evolução e práticas clínicas em um só lugar."}
            </p>
          </div>

          <form className="flex w-full flex-col gap-3.5" onSubmit={handleSignIn}>
            {mode === "signup" && <>
              <label className="sr-only" htmlFor="semiolab-name">Nome completo</label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65e5d0]" />
                <input
                  id="semiolab-name"
                  placeholder="Seu nome"
                  type="text"
                  value={name}
                  autoComplete="name"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.075] px-11 text-sm text-white outline-none transition placeholder:text-[#82969b] focus:border-[#65e5d0]/50 focus:ring-4 focus:ring-[#35c9b1]/10"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            </>}
            <label className="sr-only" htmlFor="semiolab-email">
              E-mail
            </label>
            <input
              id="semiolab-email"
              placeholder="E-mail"
              type="email"
              value={email}
              autoComplete="email"
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.075] px-5 text-sm text-white outline-none transition placeholder:text-[#82969b] focus:border-[#65e5d0]/50 focus:ring-4 focus:ring-[#35c9b1]/10"
              onChange={(event) => setEmail(event.target.value)}
            />
            <label className="sr-only" htmlFor="semiolab-password">
              Senha
            </label>
            <input
              id="semiolab-password"
              placeholder="Senha"
              type="password"
              value={password}
              autoComplete="current-password"
              className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.075] px-5 text-sm text-white outline-none transition placeholder:text-[#82969b] focus:border-[#65e5d0]/50 focus:ring-4 focus:ring-[#35c9b1]/10"
              onChange={(event) => setPassword(event.target.value)}
            />
            {mode === "signup" && <>
              <label className="sr-only" htmlFor="semiolab-confirm-password">Confirmar senha</label>
              <input
                id="semiolab-confirm-password"
                placeholder="Confirme sua senha"
                type="password"
                value={confirmPassword}
                autoComplete="new-password"
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.075] px-5 text-sm text-white outline-none transition placeholder:text-[#82969b] focus:border-[#65e5d0]/50 focus:ring-4 focus:ring-[#35c9b1]/10"
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </>}

            {error && (
              <div role="alert" className="text-left text-xs text-[#ff9a9a]">
                {error}
              </div>
            )}

            <div className="my-1 h-px bg-white/10" />

            <button
              type="submit"
              disabled={busy}
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#46d6c1] to-[#22aa98] px-5 text-sm font-extrabold text-[#03110f] shadow-[0_14px_35px_rgba(32,174,154,0.22)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? "Preparando seu acesso..." : mode === "signin" ? "Entrar" : "Criar minha conta grátis"}
              {!busy && (
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setError("O acesso pelo Google será conectado em breve.")}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-5 text-sm font-semibold text-white shadow-lg transition hover:bg-white/[0.1]"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" aria-hidden="true" className="h-5 w-5" />
              Continuar com Google
            </button>

            <div className="mt-1 text-center text-xs text-[#8da1a6]">
              {mode === "signin" ? "Ainda não tem uma conta?" : "Já possui uma conta?"}{" "}
              <button
                type="button"
                onClick={switchMode}
                className="font-semibold text-white/90 underline decoration-white/30 underline-offset-4 hover:text-white"
              >
                {mode === "signin" ? "Criar conta grátis" : "Entrar"}
              </button>
            </div>

            <div className="mt-1 flex items-center justify-center gap-1.5 border-t border-white/10 pt-4 text-[10px] text-[#73898e]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Ambiente educacional seguro
            </div>
          </form>
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-[#8da1a6] sm:mt-6 sm:text-xs">
          <span className="flex items-center gap-1.5">
            <Stethoscope className="h-3.5 w-3.5 text-[#65e5d0]" /> Consultas
          </span>
          <span className="flex items-center gap-1.5">
            <BookOpenCheck className="h-3.5 w-3.5 text-[#65e5d0]" /> Simulados
          </span>
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#65e5d0]" /> Evolução diária
          </span>
        </div>
      </div>
    </main>
  );
};

export { SignIn1 };
