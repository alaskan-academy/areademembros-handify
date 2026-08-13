"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export type DeferredStep = { targetId: string; text: string };
type Rect = { top: number; left: number; width: number; height: number };
type Pos = { top?: number; bottom?: number; left: number; width: number };

// Evento disparado pelo PageTour quando um step é adiado
export const DEFERRED_TOUR_EVENT = "handify:deferred-tour-step";

function computeTooltipPos(sr: Rect, tooltipH: number): Pos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(320, vw - 24);
  const gap = 12;
  const spaceBelow = vh - (sr.top + sr.height);
  const spaceAbove = sr.top;
  let top: number | undefined;
  let bottom: number | undefined;
  if (spaceBelow >= tooltipH + gap) top = sr.top + sr.height + gap;
  else if (spaceAbove >= tooltipH + gap) top = sr.top - tooltipH - gap;
  else bottom = 16;
  const left = Math.max(12, Math.min(sr.left, vw - w - 12));
  return bottom !== undefined ? { bottom, left, width: w } : { top, left, width: w };
}

export default function DeferredTourStep({ sectionId }: { sectionId: string }) {
  const storageKey = `handify_deferred_${sectionId}`;
  const [pending, setPending] = useState<DeferredStep[]>([]);
  const [active, setActive] = useState<DeferredStep | null>(null);
  const [spotRect, setSpotRect] = useState<Rect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<Pos | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => {
    try {
      setPending(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
    } catch { /* ignore */ }
  }, [storageKey]);

  // Carrega steps pendentes e escuta novos (disparados pelo PageTour)
  useEffect(() => {
    reload();
    window.addEventListener(DEFERRED_TOUR_EVENT, reload);
    return () => window.removeEventListener(DEFERRED_TOUR_EVENT, reload);
  }, [reload]);

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

  // Observa o primeiro step pendente — quando o elemento aparecer na tela, ativa o modal
  useEffect(() => {
    if (pending.length === 0 || active !== null) return;
    const step = pending[0];
    let alive = true;

    const attempt = () => {
      if (!alive) return;
      const candidates = Array.from(
        document.querySelectorAll(`#${CSS.escape(step.targetId)}`)
      ) as HTMLElement[];
      const el = candidates.find((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (!el) {
        setTimeout(attempt, 500);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        if (!alive) return;
        if (applyElement(el)) setActive(step);
        else setTimeout(attempt, 500);
      }, 380);
    };

    attempt();
    return () => { alive = false; };
  }, [pending, active, applyElement]);

  // Acompanha elemento no scroll/resize
  useEffect(() => {
    if (!active) return;
    const update = () => {
      const el = document.getElementById(active.targetId);
      if (el) applyElement(el);
    };
    window.addEventListener("resize", update, { passive: true });
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, [active, applyElement]);

  const dismiss = useCallback(() => {
    if (!active) return;
    const remaining = pending.filter((s) => s.targetId !== active.targetId);
    setPending(remaining);
    setActive(null);
    setSpotRect(null);
    setTooltipPos(null);
    if (remaining.length === 0) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify(remaining));
  }, [active, pending, storageKey]);

  if (!active) return null;

  return (
    <>
      {/* Spotlight */}
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

      {/* Dismiss ao tocar fora */}
      <div className="fixed inset-0 z-[9991]" onClick={dismiss} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-[9992] bg-white rounded-2xl shadow-xl"
        style={{
          ...(tooltipPos ? tooltipPos : { bottom: 20, left: 12, right: 12 }),
          maxWidth: "calc(100vw - 24px)",
          padding: "16px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[13px] text-[#2D2D2D] leading-snug mb-3">{active.text}</p>
        <div className="flex justify-end">
          <button
            onClick={dismiss}
            className="text-xs font-semibold bg-[#6699F3] text-white px-3.5 py-1.5 rounded-lg hover:bg-[#5580d4] transition-colors"
          >
            Entendi!
          </button>
        </div>
      </div>
    </>
  );
}
