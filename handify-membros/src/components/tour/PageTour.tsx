"use client";

import { useEffect, useState, useCallback } from "react";
import { markSectionVisited } from "@/lib/onboarding/actions";
import type { TourStep } from "@/lib/tour/tours";

type Rect = { top: number; left: number; width: number; height: number };
type Pos = { top: number; left: number; width: number };

function computeTooltipPos(sr: Rect): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(300, vw - 24);
  const belowTop = sr.top + sr.height + 14;
  const top = belowTop + 170 < vh ? belowTop : Math.max(12, sr.top - 170 - 14);
  const left = Math.max(12, Math.min(sr.left, vw - w - 12));
  return { top, left, width: w };
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

  const applyElement = (el: HTMLElement): boolean => {
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
    setTooltipPos(computeTooltipPos(sr));
    return true;
  };

  const seekTarget = useCallback((targetId: string) => {
    let retries = 0;
    const attempt = () => {
      const el = document.getElementById(targetId);
      if (el && applyElement(el)) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }
      if (++retries < 15) setTimeout(attempt, 200);
      else { setSpotRect(null); setTooltipPos(null); }
    };
    attempt();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!targetId) {
      setSpotRect(null);
      setTooltipPos(null);
      return;
    }
    seekTarget(targetId);
  }, [active, stepIdx, steps, seekTarget]);

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
  }, [active, stepIdx, steps]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(async () => {
    setActive(false);
    await markSectionVisited(sectionId);
  }, [sectionId]);

  const next = useCallback(() => {
    if (stepIdx < steps.length - 1) setStepIdx((i) => i + 1);
    else finish();
  }, [stepIdx, steps.length, finish]);

  if (!active || !steps[stepIdx]) return null;

  return (
    <>
      {/* Spotlight — creates the dark overlay via box-shadow */}
      {spotRect ? (
        <div
          className="fixed z-[9990] rounded-xl pointer-events-none"
          style={{
            top: spotRect.top,
            left: spotRect.left,
            width: spotRect.width,
            height: spotRect.height,
            boxShadow: "0 0 0 9999px rgba(15,15,15,0.65)",
          }}
        />
      ) : (
        <div
          className="fixed inset-0 z-[9990] pointer-events-none"
          style={{ background: "rgba(15,15,15,0.65)" }}
        />
      )}

      {/* Click-anywhere-to-dismiss layer */}
      <div className="fixed inset-0 z-[9991]" onClick={finish} />

      {/* Tooltip */}
      <div
        className="fixed z-[9992] bg-white rounded-2xl p-5"
        style={{
          ...(tooltipPos ?? { bottom: 24, left: 12, right: 12 }),
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          maxWidth: "calc(100vw - 24px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress dots */}
        {steps.length > 1 && (
          <div className="flex gap-1.5 mb-3">
            {steps.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === stepIdx ? 20 : 6,
                  background: i === stepIdx ? "#6699F3" : "#E5E5E0",
                }}
              />
            ))}
          </div>
        )}

        <p className="text-[11px] font-semibold text-[#6699F3] uppercase tracking-wide mb-1.5">
          Passo {stepIdx + 1} de {steps.length}
        </p>

        <p className="text-sm text-[#2D2D2D] leading-relaxed mb-4">
          {steps[stepIdx].text}
        </p>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={finish}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Pular
          </button>
          <button
            onClick={next}
            className="text-sm font-semibold bg-[#6699F3] text-white px-4 py-2 rounded-lg hover:bg-[#5580d4] transition-colors"
          >
            {stepIdx < steps.length - 1 ? "Próximo →" : "Entendi!"}
          </button>
        </div>
      </div>
    </>
  );
}
