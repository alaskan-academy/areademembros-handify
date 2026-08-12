"use client";

import { useState, useEffect, useTransition } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { markSectionVisited } from "@/lib/onboarding/actions";
import type { OnboardingSection } from "@/lib/onboarding/sections";

interface Props {
  section: OnboardingSection;
}

export default function SectionWelcomeBanner({ section }: Props) {
  const [visible, setVisible] = useState(true);
  const [, startTransition] = useTransition();

  // Marca como visitada imediatamente ao aparecer: dot e discovery card somem na próxima visita
  useEffect(() => {
    startTransition(() => {
      markSectionVisited(section.id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id]);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
  }

  return (
    <div className="mb-6 rounded-xl border border-[#6699F3]/30 bg-[#6699F3]/5 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#6699F3] mb-1">
            {section.descricao}
          </p>

          {section.steps.length > 0 && (
            <ol className="mt-3 space-y-1.5">
              {section.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6699F3]/15 text-[10px] font-bold text-[#6699F3]">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="shrink-0 rounded-lg p-1 text-foreground/40 hover:text-foreground hover:bg-black/5 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={dismiss}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#6699F3] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#5580d4] min-h-[40px]"
        >
          <CheckCircle2 className="h-4 w-4" />
          Entendi
        </button>
      </div>
    </div>
  );
}
