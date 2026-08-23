"use client";

import { useState } from "react";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}

/** Moldura circular de tamanho fixo (herdado do pai via 100%/100%) que
 * NUNCA deixa a foto vazar: overflow:hidden + object-fit:cover, tudo em
 * estilo inline para nunca depender de uma classe CSS externa esquecida.
 * Cai para iniciais automaticamente se não houver foto ou se falhar. */
export default function Avatar({ url, name }: { url?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
      }}
    >
      {url && !failed ? (
        <img
          src={url}
          alt={name}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
