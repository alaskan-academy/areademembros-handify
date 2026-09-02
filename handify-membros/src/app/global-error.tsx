"use client";

import { useEffect } from "react";

/**
 * Último recurso: erro no próprio layout raiz, quando `error.tsx` não chega a
 * renderizar. Substitui `<html>`/`<body>`, então o CSS global não está
 * carregado — daí os estilos inline e nenhuma dependência de componente.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] erro no layout raiz:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          padding: 24,
          textAlign: "center",
          background: "#F5F5F0",
          color: "#2D2D2D",
          fontFamily: "Montserrat, Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", width: 120, height: 4 }}>
          <span style={{ flex: 1, background: "#6699F3" }} />
          <span style={{ flex: 1, background: "#72CF92" }} />
          <span style={{ flex: 1, background: "#FEC649" }} />
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
          A plataforma não carregou
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "#63635E", margin: 0, maxWidth: 420 }}>
          Não foi nada que você fez. Tente abrir de novo — se continuar assim,
          chame a gente no WhatsApp.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 320 }}>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44, borderRadius: 8, border: "none", cursor: "pointer",
              background: "#6699F3", color: "#fff", fontSize: 16, fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            Tentar de novo
          </button>
          <a
            href="https://wa.me/message/ZVYBKLSWPO7OM1"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              minHeight: 44, borderRadius: 8, border: "2px solid #6699F3",
              color: "#6699F3", fontSize: 16, fontWeight: 600, textDecoration: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            Falar com o suporte
          </a>
        </div>
      </body>
    </html>
  );
}
