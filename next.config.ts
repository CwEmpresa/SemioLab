import type { NextConfig } from "next";

/* Cabeçalhos de segurança para todas as respostas. Antes não havia nenhum:
   o app podia ser embutido em um iframe de outro site (clickjacking) e o
   navegador podia "adivinhar" o tipo de arquivos enviados.
   - SAMEORIGIN (e não DENY): o próprio app embute o Atlas TC e o
     laboratório de ausculta em iframes da mesma origem.
   - microphone=(self): a consulta por voz precisa do microfone. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
