"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { savePosition, markLessonComplete } from "@/app/(student)/aulas/actions";

interface PandaPlayerProps {
  videoId: string;
  lessonId: string;
  initialPosition?: number;
  durationSeconds?: number;
  isCompleted?: boolean;
}

/**
 * Onde guardamos a posição quando o servidor recusa a gravação.
 *
 * Depois de um deploy, a aula que já estava aberta continua chamando a versão
 * antiga da Server Action, que não existe mais no servidor. Antes disso aqui, o
 * erro era engolido por um `.catch(() => {})` e a aluna assistia a aula inteira
 * sem nada ser salvo. Agora a posição fica no aparelho e sobe assim que a
 * página recarrega.
 */
const CHAVE_POSICAO = (lessonId: string) => `handify:posicao:${lessonId}`;

function guardarNoAparelho(lessonId: string, posicao: number) {
  try { localStorage.setItem(CHAVE_POSICAO(lessonId), String(Math.floor(posicao))); } catch { /* modo privado */ }
}

function lerDoAparelho(lessonId: string): number | null {
  try {
    const v = localStorage.getItem(CHAVE_POSICAO(lessonId));
    return v === null ? null : Number(v);
  } catch { return null; }
}

function limparDoAparelho(lessonId: string) {
  try { localStorage.removeItem(CHAVE_POSICAO(lessonId)); } catch { /* modo privado */ }
}

/**
 * Girar a tela sozinha quando a aula abre em tela cheia.
 *
 * A aluna segura o celular em pé, aperta o botão de expandir e o vídeo abre
 * deitado dentro de uma tela em pé: sobra preto em cima e embaixo e a imagem
 * fica do tamanho de um selo. Ela precisa virar o aparelho na mão, e quem está
 * com a trava de rotação ligada nem consegue.
 *
 * O botão de expandir fica dentro do iframe do Panda, que é de outro domínio,
 * então não dá para mexer nele. Mas quando o conteúdo de um iframe entra em
 * tela cheia, é a NOSSA página que entra em tela cheia, com o iframe virando o
 * `fullscreenElement`. O evento chega aqui, e a trava de orientação só é
 * permitida justamente enquanto a página está em tela cheia.
 *
 * Não funciona no iPhone: o Safari abre o vídeo no player nativo do sistema, a
 * nossa página nem fica sabendo, e a Apple não expõe trava de orientação. Lá o
 * próprio iOS já deita o vídeo quando a aluna vira o aparelho.
 *
 * `lock`/`unlock` existem nos navegadores mas ainda não estão na tipagem padrão
 * do TypeScript, daí a declaração abaixo.
 */
type TravaDeTela = ScreenOrientation & {
  lock?: (orientacao: "landscape") => Promise<void>;
  unlock?: () => void;
};

function isYouTube(value: string): boolean {
  return value.includes("youtube.com") || value.includes("youtu.be");
}

function extractYouTubeId(value: string): string | null {
  // https://www.youtube.com/watch?v=ID
  let m = value.match(/[?&]v=([^&#]+)/);
  if (m) return m[1];
  // https://youtu.be/ID
  m = value.match(/youtu\.be\/([^?&#]+)/);
  if (m) return m[1];
  // https://www.youtube.com/embed/ID
  m = value.match(/\/embed\/([^?&#]+)/);
  if (m) return m[1];
  return null;
}

function buildYouTubeEmbedUrl(value: string): string {
  const id = extractYouTubeId(value) ?? value;
  // youtube-nocookie.com: domínio de privacidade — sem cookies de rastreamento
  // rel=0: sem vídeos relacionados  |  modestbranding=1: branding mínimo
  // iv_load_policy=3: sem anotações  |  disablekb=1: sem atalhos de teclado
  // enablejsapi=1: habilita postMessage para eventos do player
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&enablejsapi=1`;
}

function buildPandaEmbedUrl(videoId: string): string {
  return videoId.startsWith("http")
    ? videoId
    : `https://player.pandavideo.com.br/embed/?v=${encodeURIComponent(videoId)}`;
}

export default function PandaPlayer({
  videoId,
  lessonId,
  initialPosition = 0,
  durationSeconds = 0,
  isCompleted = false,
}: PandaPlayerProps) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const positionRef = useRef(initialPosition);
  const autoMarkedRef = useRef(isCompleted);
  const durationRef = useRef(durationSeconds);

  const youtube = isYouTube(videoId);
  const embedUrl = youtube ? buildYouTubeEmbedUrl(videoId) : buildPandaEmbedUrl(videoId);

  // Duas falhas seguidas: quase sempre é deploy novo com a aba antiga aberta.
  const falhasRef = useRef(0);
  const [precisaRecarregar, setPrecisaRecarregar] = useState(false);

  const flushPosition = useCallback(() => {
    const posicao = positionRef.current;
    savePosition(lessonId, posicao)
      .then(() => {
        falhasRef.current = 0;
        limparDoAparelho(lessonId);
      })
      .catch(() => {
        // Não perde o progresso: guarda aqui e tenta de novo no próximo carregamento.
        guardarNoAparelho(lessonId, posicao);
        falhasRef.current += 1;
        if (falhasRef.current >= 2) setPrecisaRecarregar(true);
      });
  }, [lessonId]);

  const autoMark = useCallback(() => {
    if (autoMarkedRef.current) return;
    autoMarkedRef.current = true;
    markLessonComplete(lessonId)
      .then(() => router.refresh())
      .catch(() => {
        // Deixa tentar de novo em vez de dar a aula como concluída sem estar.
        autoMarkedRef.current = false;
        setPrecisaRecarregar(true);
      });
  }, [lessonId, router]);

  useEffect(() => {
    autoMarkedRef.current = isCompleted;
  }, [isCompleted]);

  // Sobrou posição de uma sessão em que o servidor recusou a gravação? Sobe agora.
  useEffect(() => {
    const pendente = lerDoAparelho(lessonId);
    if (pendente === null || pendente <= initialPosition) {
      if (pendente !== null) limparDoAparelho(lessonId);
      return;
    }
    positionRef.current = Math.max(positionRef.current, pendente);
    savePosition(lessonId, pendente)
      .then(() => limparDoAparelho(lessonId))
      .catch(() => { /* tenta de novo no próximo carregamento */ });
  }, [lessonId, initialPosition]);

  useEffect(() => {
    if (durationSeconds > 0 && durationRef.current === 0) {
      durationRef.current = durationSeconds;
    }
  }, [durationSeconds]);

  // postMessage: trata eventos do Panda Video e da YouTube IFrame API
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      let data: Record<string, unknown> | null = null;

      if (typeof event.data === "string") {
        try { data = JSON.parse(event.data); } catch { return; }
      } else if (event.data && typeof event.data === "object") {
        data = event.data as Record<string, unknown>;
      }
      if (!data) return;

      const eventName = String(data.event ?? data.type ?? "").toLowerCase();
      if (!eventName) return;

      // YouTube IFrame API: { event: "onStateChange", info: 0 } → 0 = ended
      if (eventName === "onstatechange" && data.info === 0) {
        autoMark();
        return;
      }

      if (eventName === "ended" || eventName === "pandavideo:ended" || eventName === "finish") {
        autoMark();
        return;
      }

      if (eventName === "timeupdate" || eventName === "pandavideo:timeupdate" || eventName === "progress") {
        const ct = typeof data.currentTime === "number" ? data.currentTime : null;
        const dur = typeof data.duration === "number" ? data.duration : null;

        if (ct !== null) positionRef.current = Math.floor(ct);
        if (dur && dur > 0) durationRef.current = dur;

        if (durationRef.current > 0 && positionRef.current >= durationRef.current * 0.9) {
          autoMark();
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [autoMark]);

  // Timer de fallback: funciona para Panda e YouTube (cross-origin — postMessage pode não chegar)
  useEffect(() => {
    const startPos = initialPosition;
    const startTime = Date.now();

    const timer = setInterval(() => {
      const realElapsed = (Date.now() - startTime) / 1000;
      const estimated = Math.floor(startPos + realElapsed);
      positionRef.current = Math.max(positionRef.current, estimated);

      flushPosition();

      const dur = durationRef.current;
      if (dur > 0 && positionRef.current >= dur * 0.9) {
        autoMark();
      }
    }, 10_000);

    return () => {
      clearInterval(timer);
      flushPosition();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, initialPosition]);

  // Tela cheia abre deitada. Ver a explicação em TravaDeTela, lá em cima.
  useEffect(() => {
    const tela = screen.orientation as TravaDeTela | undefined;
    if (!tela?.lock) return;

    let travamos = false;

    const soltar = () => {
      if (!travamos) return;
      travamos = false;
      try { tela.unlock?.(); } catch { /* navegador sem suporte */ }
    };

    function aoMudarTelaCheia() {
      const doc = document as Document & { webkitFullscreenElement?: Element | null };
      const emTelaCheia = document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      const ehONossoVideo =
        emTelaCheia !== null &&
        iframeRef.current !== null &&
        (emTelaCheia === iframeRef.current || emTelaCheia.contains(iframeRef.current));

      if (ehONossoVideo) {
        // Promise recusada é o caso normal no computador, que não gira.
        tela!.lock!("landscape").then(() => { travamos = true; }).catch(() => {});
      } else {
        soltar();
      }
    }

    document.addEventListener("fullscreenchange", aoMudarTelaCheia);
    document.addEventListener("webkitfullscreenchange", aoMudarTelaCheia);
    return () => {
      document.removeEventListener("fullscreenchange", aoMudarTelaCheia);
      document.removeEventListener("webkitfullscreenchange", aoMudarTelaCheia);
      soltar();
    };
  }, []);

  return (
    <>
      {precisaRecarregar && (
        <div
          role="alert"
          className="mb-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border border-[#FEC649]/60 bg-[#FEC649]/15 px-4 py-3 text-sm"
        >
          <p className="flex-1 leading-relaxed">
            <strong className="font-semibold">Saiu uma versão nova da plataforma.</strong>{" "}
            Recarregue a página para o seu progresso voltar a ser salvo. Você continua de onde parou.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="shrink-0 rounded-lg bg-[#6699F3] px-4 text-sm font-semibold text-white min-h-[44px] hover:bg-[#5580d4] handify-transition"
          >
            Recarregar
          </button>
        </div>
      )}
    <div className="w-full aspect-video rounded-xl overflow-hidden bg-black shadow-lg relative">
      <iframe
        ref={iframeRef}
        src={embedUrl}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        className="w-full h-full border-0"
        title="Aula em vídeo"
      />
      {/* Camada que captura clique direito no container — dificulta compartilhamento para usuárias não técnicas */}
      {youtube && (
        <div
          className="absolute inset-0 pointer-events-none"
          onContextMenu={(e) => e.preventDefault()}
        />
      )}
    </div>
    </>
  );
}
