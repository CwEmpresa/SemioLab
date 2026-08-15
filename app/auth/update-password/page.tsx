"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Crie uma senha com pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError("Não foi possível redefinir sua senha. Solicite um novo link.");
      return;
    }
    setDone(true);
  }

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#041216] px-4 py-8 font-sans text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(53,201,177,0.22),transparent_32%),radial-gradient(circle_at_86%_85%,rgba(29,137,122,0.18),transparent_31%),linear-gradient(145deg,#041216,#08272c_52%,#06231f)]" />
      <section className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.11] via-white/[0.055] to-white/[0.025] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        {done ? (
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Senha redefinida</h1>
            <p className="mt-3 text-sm text-[#a9bec2]">Sua senha foi alterada com sucesso. Você já pode entrar com a nova senha.</p>
            <a href="/" className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#46d6c1] to-[#22aa98] px-6 text-sm font-bold text-[#03110f]">Ir para o login</a>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-center">Defina sua nova senha</h1>
            <form className="mt-6 flex flex-col gap-3.5" onSubmit={handleSubmit}>
              <input
                type="password"
                placeholder="Nova senha"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.075] px-5 text-sm text-white outline-none transition placeholder:text-[#82969b] focus:border-[#65e5d0]/50 focus:ring-4 focus:ring-[#35c9b1]/10"
              />
              <input
                type="password"
                placeholder="Confirme a nova senha"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.075] px-5 text-sm text-white outline-none transition placeholder:text-[#82969b] focus:border-[#65e5d0]/50 focus:ring-4 focus:ring-[#35c9b1]/10"
              />
              {error && <div role="alert" className="text-left text-xs text-[#ff9a9a]">{error}</div>}
              <button
                type="submit"
                disabled={busy}
                className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#46d6c1] to-[#22aa98] px-5 text-sm font-extrabold text-[#03110f] shadow-[0_14px_35px_rgba(32,174,154,0.22)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
              >
                {busy ? "Salvando..." : "Salvar nova senha"}
              </button>
              <div className="mt-1 flex items-center justify-center gap-1.5 border-t border-white/10 pt-4 text-[10px] text-[#73898e]">
                <ShieldCheck className="h-3.5 w-3.5" /> Ambiente educacional seguro
              </div>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
