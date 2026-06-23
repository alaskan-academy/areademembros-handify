"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Sem conexão — Handify™</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Montserrat', Arial, Helvetica, sans-serif;
            background: #F5F5F0;
            color: #2D2D2D;
            min-height: 100svh;
            display: flex;
            flex-direction: column;
          }
          .stripe { display: flex; height: 4px; width: 100%; }
          .stripe span:nth-child(1) { flex: 1; background: #6699F3; }
          .stripe span:nth-child(2) { flex: 1; background: #72CF92; }
          .stripe span:nth-child(3) { flex: 1; background: #FEC649; }
        `}</style>
      </head>
      <body>
        <div className="stripe" style={{ display: "flex", height: 4 }}>
          <span style={{ flex: 1, background: "#6699F3" }} />
          <span style={{ flex: 1, background: "#72CF92" }} />
          <span style={{ flex: 1, background: "#FEC649" }} />
        </div>

        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
          gap: "1.5rem",
        }}>
          {/* Ícone */}
          <div style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "rgba(102,153,243,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <WifiOff style={{ width: 32, height: 32, color: "#6699F3" }} />
          </div>

          {/* Texto */}
          <div style={{ maxWidth: 320 }}>
            <p style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              marginBottom: "0.5rem",
            }}>
              Você está sem conexão
            </p>
            <p style={{
              fontSize: "0.875rem",
              color: "#6b7280",
              lineHeight: 1.6,
            }}>
              Verifique sua internet e tente novamente. Os cursos que já foram abertos podem estar disponíveis offline.
            </p>
          </div>

          {/* Botão */}
          <button
            onClick={() => window.location.reload()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem 1.5rem",
              borderRadius: "0.5rem",
              background: "#6699F3",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.875rem",
              border: "none",
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            <RefreshCw style={{ width: 16, height: 16 }} />
            Tentar novamente
          </button>
        </div>

        {/* Rodapé */}
        <footer style={{
          padding: "1rem",
          textAlign: "center",
          fontSize: "0.75rem",
          color: "#9ca3af",
          borderTop: "1px solid rgba(0,0,0,0.06)",
        }}>
          © {new Date().getFullYear()} Handify™
        </footer>
      </body>
    </html>
  );
}
