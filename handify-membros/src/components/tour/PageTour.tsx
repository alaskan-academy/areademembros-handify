"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { markSectionVisited } from "@/lib/onboarding/actions";
import type { TourStep } from "@/lib/tour/tours";
import { DEFERRED_TOUR_EVENT } from "@/components/tour/DeferredTourStep";

type Rect = { top: number; left: number; width: number; height: number };
type Pos = { top?: number; bottom?: number; left: number; width: number };

// Spot agrupa rect + posição do tooltip com o step a que pertencem.
// Isso evita que o spotRect de um step vaze para o próximo durante a janela
// entre o render (stepIdx novo) e o efeito (que limpa o spot).
type Spot = { forStep: number; rect: Rect; pos: Pos };

function computeTooltipPos(sr: Rect, tooltipH: number): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(320, vw - 24);
  const gap = 12;
  const spaceBelow = vh - (sr.top + sr.height);
  const spaceAbove = sr.top;

  let top: number | undefined;
  let bottom: number | undefined;

  if (spaceBelow >= tooltipH + gap) {
    top = sr.top + sr.height + gap;
  } else if (spaceAbove >= tooltipH + gap) {
    top = sr.top - tooltipH - gap;
  } else {
    bottom = 16;
  }

  const left = Math.max(12, Math.min(sr.left, vw - w - 12));
  return bottom !== undefined ? { bottom, left, width: w } : { top, left, width: w };
}

export default function PageTour({
  sectionId,
  visited,
  steps,
}: {
  sectionId: string;
  visited: boolean;
  steps: TourStep[];
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [active, setActive] = useState(false);
  // spot é inválido quando forStep !== stepIdx — previne flash do rect do passo anterior
  const [spot, setSpot] = useState<Spot | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Lê a posição atual do elemento e armazena junto ao step a que pertence
  const applyElement = useCallback((el: HTMLElement, forStep: number): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const pad = 8;
    const sr: Rect = {
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    };
    const tooltipH = tooltipRef.current?.offsetHeight ?? 130;
    setSpot({ forStep, rect: sr, pos: computeTooltipPos(sr, tooltipH) });
    return true;
  }, []);

  // Busca o elemento visível com retries; chama onFound ou onNotFound
  const seekTarget = useCallback((
    targetId: string,
    onFound: (el: HTMLElement) => boolean,
    onNotFound?: () => void,
  ) => {
    let retries = 0;
    const attempt = () => {
      const candidates = Array.from(
        document.querySelectorAll(`#${CSS.escape(targetId)}`)
      ) as HTMLElement[];
      const el = candidates.find((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });

      if (!el) {
        if (++retries < 15) setTimeout(attempt, 200);
        else onNotFound?.();
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        if (onFound(el)) return;
        if (++retries < 15) setTimeout(attempt, 200);
        else onNotFound?.();
      }, 380);
    };
    attempt();
  }, []);

  const finish = useCallback(async () => {
    setActive(false);
    await markSectionVisited(sectionId);
  }, [sectionId]);

  const next = useCallback(() => {
    if (stepIdx < steps.length - 1) setStepIdx((i) => i + 1);
    else finish();
  }, [stepIdx, steps.length, finish]);

  // Auto-start após delay
  useEffect(() => {
    if (visited || steps.length === 0) return;
    const t = setTimeout(() => setActive(true), 700);
    return () => clearTimeout(t);
  }, [visited, steps.length]);

  // Busca elemento quando o step muda
  useEffect(() => {
    if (!active) return;
    const currentStep = stepIdx;
    const targetId = steps[currentStep]?.targetId ?? "";

    // Limpa spot imediatamente — spot.forStep !== currentStep vai retornar null no render
    setSpot(null);
    if (!targetId) return;

    let alive = true;

    const onNotFound = () => {
      if (!alive) return;
      // Adia o step para quando o elemento aparecer na tela (outra aula, etc.)
      const step = steps[currentStep];
      if (step?.targetId) {
        const key = `handify_deferred_${sectionId}`;
        try {
          const existing: { targetId: string; text: string }[] = JSON.parse(
            localStorage.getItem(key) ?? "[]"
          );
          if (!existing.some((s) => s.targetId === step.targetId)) {
            localStorage.setItem(
              key,
              JSON.stringify([...existing, { targetId: step.targetId, text: step.text }])
            );
            window.dispatchEvent(new Event(DEFERRED_TOUR_EVENT));
          }
        } catch { /* ignore */ }
      }
      if (currentStep < steps.length - 1) setStepIdx((i) => i + 1);
      else finish();
    };

    seekTarget(
      targetId,
      (el) => {
        if (!alive) return false;
        return applyElement(el, currentStep);
      },
      onNotFound,
    );

    return () => { alive = false; };
  }, [active, stepIdx, steps, seekTarget, applyElement, finish, sectionId]);

  // Atualiza posição do spotlight no scroll/resize
  useEffect(() => {
    if (!active) return;
    const currentStep = stepIdx;
    const targetId = steps[currentStep]?.targetId;
    if (!targetId) return;
    const update = () => {
      const el = document.getElementById(targetId);
      if (el) applyElement(el, currentStep);
    };
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [active, stepIdx, steps, applyElement]);

  if (!active || !steps[stepIdx]) return null;

  const targetId = steps[stepIdx].targetId;
  // spotRect só é válido quando forStep bate com o stepIdx atual
  const spotRect = spot?.forStep === stepIdx ? spot.rect : null;
  const tooltipPos = spot?.forStep === stepIdx ? spot.pos : null;

  // Aguarda o elemento ser encontrado antes de renderizar qualquer coisa
  if (targetId && !spotRect) return null;

  const isLast = stepIdx === steps.length - 1;

  return (
    <>
      {/* Spotlight overlay */}
      {spotRect ? (
        <div
          className="fixed z-[9990] rounded-xl pointer-events-none"
          style={{
            top: spotRect.top,
            left: spotRect.left,
            width: spotRect.width,
            height: spotRect.height,
            boxShadow: "0 0 0 9999px rgba(15,15,15,0.7)",
          }}
        />
      ) : (
        <div
          className="fixed inset-0 z-[9990] pointer-events-none"
          style={{ background: "rgba(15,15,15,0.7)" }}
        />
      )}

      {/* Fechar ao tocar fora do tooltip */}
      <div className="fixed inset-0 z-[9991]" onClick={finish} aria-hidden="true" />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[9992] bg-white rounded-2xl shadow-xl"
        style={{
          ...(tooltipPos
            ? tooltipPos
            : { bottom: 20, left: 12, right: 12 }),
          maxWidth: "calc(100vw - 24px)",
          padding: "16px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dots de progresso */}
        {steps.length > 1 && (
          <div className="flex gap-1.5 mb-2.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === stepIdx ? 18 : 5,
                  background: i === stepIdx ? "#6699F3" : "#E5E5E0",
                }}
              />
            ))}
          </div>
        )}

        <p className="text-[13px] text-[#2D2D2D] leading-snug mb-3">
          {steps[stepIdx].text}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={finish}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Pular
          </button>
          <button
            onClick={next}
            className="text-xs font-semibold bg-[#6699F3] text-white px-3.5 py-1.5 rounded-lg hover:bg-[#5580d4] transition-colors"
          >
            {isLast ? "Entendi!" : "Próximo →"}
          </button>
        </div>
      </div>
    </>
  );
}
