"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { markSectionVisited } from "@/lib/onboarding/actions";
import type { TourStep } from "@/lib/tour/tours";

type Rect = { top: number; left: number; width: number; height: number };
type Pos = { top?: number; bottom?: number; left: number; width: number };

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
    // Not enough room above or below — anchor to bottom of screen
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
  const [spotRect, setSpotRect] = useState<Rect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<Pos | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const applyElement = useCallback((el: HTMLElement): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const pad = 8;
    const sr: Rect = {
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    };
    setSpotRect(sr);
    const tooltipH = tooltipRef.current?.offsetHeight ?? 130;
    setTooltipPos(computeTooltipPos(sr, tooltipH));
    return true;
  }, []);

  const seekTarget = useCallback((targetId: string, onNotFound?: () => void) => {
    let retries = 0;
    const attempt = () => {
      // querySelectorAll garante que pegamos o elemento VISÍVEL quando há IDs duplicados
      // (ex: mesmo id no sidebar desktop hidden + bottom nav mobile visible)
      const candidates = Array.from(document.querySelectorAll(`#${CSS.escape(targetId)}`)) as HTMLElement[];
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
        if (applyElement(el)) return;
        if (++retries < 15) setTimeout(attempt, 200);
        else onNotFound?.();
      }, 380);
    };
    attempt();
  }, [applyElement]);

  // finish e next definidos antes dos useEffects que os referenciam
  const finish = useCallback(async () => {
    setActive(false);
    await markSectionVisited(sectionId);
  }, [sectionId]);

  const next = useCallback(() => {
    if (stepIdx < steps.length - 1) setStepIdx((i) => i + 1);
    else finish();
  }, [stepIdx, steps.length, finish]);

  // Auto-start after delay
  useEffect(() => {
    if (visited || steps.length === 0) return;
    const t = setTimeout(() => setActive(true), 700);
    return () => clearTimeout(t);
  }, [visited, steps.length]);

  // Seek element when step changes (empty targetId = informational step, no spotlight)
  useEffect(() => {
    if (!active) return;
    const targetId = steps[stepIdx]?.targetId ?? "";
    // Limpa spotlight imediatamente para não vazar o rect do passo anterior
    setSpotRect(null);
    setTooltipPos(null);
    if (!targetId) return;
    // Se o elemento não aparecer após retries, pula automaticamente este step
    let alive = true;
    const onNotFound = () => {
      if (!alive) return;
      if (stepIdx < steps.length - 1) setStepIdx((i) => i + 1);
      else finish();
    };
    seekTarget(targetId, onNotFound);
    return () => { alive = false; };
  }, [active, stepIdx, steps, seekTarget, finish]);

  // Track element on scroll / resize
  useEffect(() => {
    if (!active) return;
    const targetId = steps[stepIdx]?.targetId;
    if (!targetId) return;
    const update = () => {
      const el = document.getElementById(targetId);
      if (el) applyElement(el);
    };
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [active, stepIdx, steps, applyElement]);

  if (!active || !steps[stepIdx]) return null;

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

      {/* Dismiss on tap outside tooltip */}
      <div className="fixed inset-0 z-[9991]" onClick={finish} />

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
        {/* Progress dots */}
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
