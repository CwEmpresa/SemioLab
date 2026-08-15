export default function AuthErrorPage() {
  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center bg-[#041216] px-4 text-white">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center backdrop-blur-2xl">
        <h1 className="text-2xl font-semibold">Link inválido ou expirado</h1>
        <p className="mt-3 text-sm text-[#a9bec2]">
          Este link de confirmação ou redefinição de senha não é mais válido. Solicite um novo e-mail e tente novamente.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-[#46d6c1] to-[#22aa98] px-6 text-sm font-bold text-[#03110f]"
        >
          Voltar ao início
        </a>
      </div>
    </main>
  );
}
