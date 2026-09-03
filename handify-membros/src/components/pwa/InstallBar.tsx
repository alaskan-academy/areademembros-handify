"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useModalBackGuard } from "@/hooks/useModalBackGuard";

/**
 * Tarja fixa no topo convidando a instalar o app.
 *
 * Substitui o aviso flutuante (`InstallPrompt`), que cobria a tela inteira com
 * um modal — intrusivo, e ainda por cima aparecia sobre o conteudo que a aluna
 * estava lendo. A tarja fica no topo, nao tapa nada e sai com um toque no X.
 *
 * A altura vai para `--install-bar-h` no <html> porque o header e a barra
 * lateral se posicionam a partir do topo (`sticky top-0` e `fixed top-[61px]`):
 * sem descontar a tarja, ela cobriria o header ao rolar a pagina.
 */

const DISMISSED_KEY = "handify-install-bar-dismissed";
const ALTURA = "52px"; // deixa 44px de alvo de toque, o minimo usado no projeto

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

/** `installable` = Android/Chrome (instala com um toque); `ios` = passo a passo manual. */
type Estado = "oculta" | "installable" | "ios";

function rodandoComoApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  );
}

export default function InstallBar() {
  const [estado, setEstado] = useState<Estado>("oculta");
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [passosAbertos, setPassosAbertos] = useState(false);
  useModalBackGuard(passosAbertos, () => setPassosAbertos(false));

  useEffect(() => {
    if (rodandoComoApp()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) {
      // Fora do Safari o iOS nao tem "Adicionar a Tela de Inicio" — sem isso o
      // convite viraria uma promessa que o navegador nao cumpre.
      // Detectar plataforma exige `navigator`, que so existe depois de montar —
      // roda uma vez, sem cascata de renders.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!/CriOS|FxiOS|OPiOS|mercury/i.test(ua)) setEstado("ios");
      return;
    }

    // O script no <head> guarda o evento antes do React montar — o navegador o
    // dispara uma unica vez, entao na pratica o listener abaixo quase nunca ve.
    const jaCapturado = (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent })
      .__pwaInstallPrompt;
    if (jaCapturado) {
      setEvento(jaCapturado);
      setEstado("installable");
    }

    // Em desenvolvimento o `next-pwa` fica desligado, entao o navegador nunca
    // dispara `beforeinstallprompt` e a tarja nao apareceria nunca no
    // localhost — sem isso, so daria para conferir o visual em producao.
    // O botao fica inerte aqui: sem evento, nao ha o que instalar.
    if (process.env.NODE_ENV === "development" && !jaCapturado) {
      setEstado("installable");
    }

    function aoReceber(e: Event) {
      e.preventDefault();
      setEvento(e as BeforeInstallPromptEvent);
      setEstado("installable");
    }
    function aoInstalar() {
      setEstado("oculta");
    }

    window.addEventListener("beforeinstallprompt", aoReceber);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoReceber);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  // Reserva o espaco no topo enquanto a tarja existe, e devolve quando ela sai.
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.style.setProperty("--install-bar-h", estado === "oculta" ? "0px" : ALTURA);
    return () => raiz.style.setProperty("--install-bar-h", "0px");
  }, [estado]);

  function fechar() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setEstado("oculta");
    setPassosAbertos(false);
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    setEvento(null);
    if (outcome === "accepted") setEstado("oculta");
  }

  if (estado === "oculta") return null;

  return (
    <div className="sticky top-0 z-50 bg-[#0F0F0F] text-white" style={{ height: ALTURA }}>
      <div className="h-full px-3 sm:px-6 lg:px-8 flex items-center gap-3">
        <p className="flex-1 min-w-0 text-[13px] leading-tight">
          <span className="font-semibold">Instale o app Handify™</span>
          <span className="hidden sm:inline text-white/60">
            {" "}— seus cursos direto da tela inicial
          </span>
        </p>

        {estado === "installable" ? (
          <button
            onClick={instalar}
            className="shrink-0 flex items-center gap-1.5 px-3.5 h-11 rounded-lg bg-[#6699F3] text-white text-[13px] font-semibold hover:bg-[#5580d4] handify-transition"
          >
            <Download className="w-4 h-4 shrink-0" />
            Baixar
          </button>
        ) : (
          <button
            onClick={() => setPassosAbertos((v) => !v)}
            aria-expanded={passosAbertos}
            className="shrink-0 flex items-center gap-1.5 px-3.5 h-11 rounded-lg bg-[#6699F3] text-white text-[13px] font-semibold hover:bg-[#5580d4] handify-transition"
          >
            <Share className="w-4 h-4 shrink-0" />
            Baixar
          </button>
        )}

        <button
          onClick={fechar}
          aria-label="Fechar aviso de instalação"
          className="shrink-0 w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 handify-transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {passosAbertos && (
        <div className="absolute inset-x-0 top-full bg-[#0F0F0F] border-t border-white/10 px-3 sm:px-6 lg:px-8 py-4 shadow-xl">
          <p className="text-[13px] font-semibold mb-2.5">Como instalar no iPhone:</p>
          <ol className="space-y-2 text-[13px] text-white/70 leading-snug">
            {[
              <>
                Toque em <strong className="text-white">Compartilhar</strong>{" "}
                <Share className="w-3.5 h-3.5 inline -mt-0.5" /> na barra do Safari
              </>,
              <>
                Role e toque em{" "}
                <strong className="text-white">&quot;Adicionar à Tela de Início&quot;</strong>
              </>,
              <>
                Toque em <strong className="text-white">Adicionar</strong>, no canto superior
                direito
              </>,
            ].map((texto, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#6699F3] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span>{texto}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
