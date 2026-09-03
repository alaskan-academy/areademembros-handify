"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useModalBackGuard } from "@/hooks/useModalBackGuard";
import { registrarAppInstalado } from "@/lib/pwa/actions";

/**
 * Tarja fixa no topo convidando a instalar o app.
 *
 * Substitui o aviso flutuante, que cobria a tela inteira com um modal por cima
 * do conteudo que a aluna estava lendo. A tarja fica no topo, nao tapa nada e
 * sai com um toque no X.
 *
 * A altura vai para `--install-bar-h` no <html> porque o header e a barra
 * lateral se posicionam a partir do topo (`sticky top-0` e `fixed top-[61px]`):
 * sem descontar a tarja, ela cobriria o header ao rolar a pagina.
 *
 * Aparece apenas para quem ainda nao instalou, e cada navegador informa isso de
 * um jeito diferente:
 *
 * - Rodando de dentro do app: `display-mode: standalone` — nao mostra, e
 *   aproveita para registrar a instalacao no perfil.
 * - Chrome/Edge/Firefox: nao disparam `beforeinstallprompt` quando o app ja
 *   esta instalado. O silencio do evento e a propria garantia.
 * - Safari no iPhone: nao tem evento nem API. Depende do registro no perfil
 *   (feito quando ela abre pelo icone) ou do "Ja instalei" na tarja.
 */

const DISMISSED_KEY = "handify-install-bar-dismissed";
const ALTURA = "52px"; // deixa 44px de alvo de toque, o minimo usado no projeto

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

/** `installable` = Android/Chrome (instala com um toque); `ios` = passo a passo manual. */
type Estado = "oculta" | "installable" | "ios";

/** Esta pagina esta rodando de dentro do app instalado? */
function rodandoComoApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone === true
  );
}

export default function InstallBar({
  /**
   * Ja consta no perfil que esta aluna tem o app. Vem do servidor porque o
   * iPhone nao tem como informar isso ao Safari.
   */
  appInstalado = false,
}: {
  appInstalado?: boolean;
}) {
  const [estado, setEstado] = useState<Estado>("oculta");
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [passosAbertos, setPassosAbertos] = useState(false);
  useModalBackGuard(passosAbertos, () => setPassosAbertos(false));

  useEffect(() => {
    if (rodandoComoApp()) {
      // Abriu pelo icone da tela inicial — no iPhone essa e a unica prova de
      // que o app esta instalado. Registra no perfil para a tarja nao voltar a
      // aparecer quando ela abrir a plataforma pelo Safari.
      if (!appInstalado) registrarAppInstalado().catch(() => {});
      return;
    }

    if (appInstalado) return;
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

    // O script no <head> guarda o evento antes do React montar, porque o
    // navegador o dispara uma unica vez e o listener abaixo quase nunca ve.
    const jaCapturado = (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent })
      .__pwaInstallPrompt;
    if (jaCapturado) {
      setEvento(jaCapturado);
      setEstado("installable");
    }

    // Em desenvolvimento o `next-pwa` fica desligado ("PWA support is disabled"
    // no log do dev), entao o navegador nunca dispara `beforeinstallprompt` e a
    // tarja nao apareceria nunca no localhost. O botao fica inerte aqui: sem
    // evento, nao ha o que instalar.
    if (process.env.NODE_ENV === "development" && !jaCapturado) {
      setEstado("installable");
    }

    function aoReceber(e: Event) {
      e.preventDefault();
      setEvento(e as BeforeInstallPromptEvent);
      setEstado("installable");
    }

    window.addEventListener("beforeinstallprompt", aoReceber);
    return () => window.removeEventListener("beforeinstallprompt", aoReceber);
  }, [appInstalado]);

  // O registro fica num efeito proprio porque precisa valer mesmo quando a
  // tarja nao aparece: a aluna pode ter fechado a tarja e instalado depois pelo
  // botao do perfil. No efeito acima esse caso caia num `return` antecipado e a
  // instalacao passava batida.
  useEffect(() => {
    if (appInstalado) return;
    function aoInstalar() {
      setEstado("oculta");
      registrarAppInstalado().catch(() => {});
    }
    window.addEventListener("appinstalled", aoInstalar);
    return () => window.removeEventListener("appinstalled", aoInstalar);
  }, [appInstalado]);

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

  /** Ela diz que ja instalou: vale para a conta, nao so para este navegador. */
  function jaInstalei() {
    registrarAppInstalado().catch(() => {});
    fechar();
  }

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    setEvento(null);
    if (outcome === "accepted") {
      setEstado("oculta");
      registrarAppInstalado().catch(() => {});
    }
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

        <button
          onClick={estado === "installable" ? instalar : () => setPassosAbertos((v) => !v)}
          aria-expanded={estado === "ios" ? passosAbertos : undefined}
          className="shrink-0 flex items-center gap-1.5 px-3.5 h-11 rounded-lg bg-[#6699F3] text-white text-[13px] font-semibold hover:bg-[#5580d4] handify-transition"
        >
          {estado === "installable" ? (
            <Download className="w-4 h-4 shrink-0" />
          ) : (
            <Share className="w-4 h-4 shrink-0" />
          )}
          Baixar
        </button>

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

          {/*
            No iPhone nao ha como o site saber que o app ja esta na tela
            inicial. Quem ja instalou precisa de uma saida que valha para a
            conta — nao so para este navegador.
          */}
          <button
            onClick={jaInstalei}
            className="mt-3 min-h-[44px] text-[13px] text-white/60 hover:text-white underline handify-transition"
          >
            Já instalei o app
          </button>
        </div>
      )}
    </div>
  );
}
