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
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "forgot";

type SignIn1Props = {
  onSignIn?: () => void;
};

const SignIn1 = ({ onSignIn }: SignIn1Props) => {
  const [mode, setMode] = React.useState<Mode>("signin");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  async function handleSignIn(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");
    setNotice("");

    if (mode === "forgot") {
      if (!email || !validateEmail(email)) {
        setError("Informe um endereço de e-mail válido.");
        return;
      }
      setBusy(true);
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/confirm`,
      });
      setBusy(false);
      if (resetError) {
        setError("Não foi possível enviar o e-mail de recuperação. Tente novamente.");
        return;
      }
      setNotice("Enviamos um link de redefinição de senha para o seu e-mail.");
      return;
    }

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

    setBusy(true);
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      setBusy(false);
      if (signUpError) {
        setError(
          /already registered|already exists/i.test(signUpError.message)
            ? "Este e-mail já possui uma conta."
            : "Não foi possível criar sua conta. Tente novamente.",
        );
        return;
      }
      if (!data.session) {
        setNotice("Enviamos um e-mail de confirmação. Verifique sua caixa de entrada para ativar sua conta.");
        return;
      }
      onSignIn?.();
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError(
        /email not confirmed/i.test(signInError.message)
          ? "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada."
          : "E-mail ou senha incorretos.",
      );
      return;
    }
    onSignIn?.();
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setNotice("");
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
              {mode === "signin" ? "BEM-VINDO" : mode === "signup" ? "COMECE AGORA" : "RECUPERAR ACESSO"}
            </span>
            <h1 className="text-balance text-[1.75rem] font-semibold leading-none tracking-[-0.045em] text-white sm:text-4xl">
              {mode === "signin" ? "Entre no SemioLab" : mode === "signup" ? "Crie sua conta grátis" : "Esqueci minha senha"}
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-6 text-[#a9bec2]">
              {mode === "signin"
                ? "Transforme estudo diário em raciocínio clínico de verdade."
                : mode === "signup"
                ? "Tenha seu espaço de estudo, evolução e práticas clínicas em um só lugar."
                : "Informe seu e-mail para receber um link de redefinição de senha."}
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
            {mode !== "forgot" && <>
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
            </>}
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

            {mode === "signin" && (
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="-mt-1.5 self-end bg-transparent border-0 shadow-none appearance-none text-xs font-semibold text-[#7fe0cd]! underline decoration-[#7fe0cd]/40 underline-offset-4 hover:text-[#a6f0e1]! hover:decoration-[#a6f0e1]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#46d6c1] rounded-sm px-1 py-1"
              >
                Esqueci minha senha
              </button>
            )}

            {error && (
              <div role="alert" className="text-left text-xs text-[#ff9a9a]">
                {error}
              </div>
            )}
            {notice && (
              <div className="text-left text-xs text-[#7fe8c9]">
                {notice}
              </div>
            )}

            <div className="my-1 h-px bg-white/10" />

            <button
              type="submit"
              disabled={busy}
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#46d6c1] to-[#22aa98] px-5 text-sm font-extrabold text-[#03110f] shadow-[0_14px_35px_rgba(32,174,154,0.22)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
            >
              {busy
                ? "Processando..."
                : mode === "signin"
                ? "Entrar"
                : mode === "signup"
                ? "Criar minha conta grátis"
                : "Enviar link de recuperação"}
              {!busy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
            </button>

            <div className="mt-1 text-center text-xs text-[#8da1a6]">
              {mode === "signin" && <>
                Ainda não tem uma conta?{" "}
                <button type="button" onClick={() => switchMode("signup")} className="bg-transparent border-0 shadow-none appearance-none font-semibold text-[#7fe0cd]! underline decoration-[#7fe0cd]/40 underline-offset-4 hover:text-[#a6f0e1]! hover:decoration-[#a6f0e1]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#46d6c1] rounded-sm px-1 py-1">
                  Criar conta grátis
                </button>
              </>}
              {mode === "signup" && <>
                Já possui uma conta?{" "}
                <button type="button" onClick={() => switchMode("signin")} className="bg-transparent border-0 shadow-none appearance-none font-semibold text-[#7fe0cd]! underline decoration-[#7fe0cd]/40 underline-offset-4 hover:text-[#a6f0e1]! hover:decoration-[#a6f0e1]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#46d6c1] rounded-sm px-1 py-1">
                  Entrar
                </button>
              </>}
              {mode === "forgot" && <>
                Lembrou sua senha?{" "}
                <button type="button" onClick={() => switchMode("signin")} className="bg-transparent border-0 shadow-none appearance-none font-semibold text-[#7fe0cd]! underline decoration-[#7fe0cd]/40 underline-offset-4 hover:text-[#a6f0e1]! hover:decoration-[#a6f0e1]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#46d6c1] rounded-sm px-1 py-1">
                  Voltar ao login
                </button>
              </>}
            </div>

            <div className="mt-1 flex items-center justify-center gap-1.5 border-t border-white/10 pt-4 text-[10px] text-[#73898e]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Ambiente educacional seguro
            </div>
            <div className="flex items-center justify-center text-center text-[10px] text-[#73898e]">
              <a href="/legal" target="_blank" rel="noopener noreferrer" className="underline decoration-white/20 underline-offset-2 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#46d6c1] rounded-sm">
                Termos, privacidade e informações legais
              </a>
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
