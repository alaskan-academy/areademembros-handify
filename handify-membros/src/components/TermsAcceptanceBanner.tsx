"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileText, X, Loader2 } from "lucide-react";
import { acceptTerms } from "@/lib/terms/actions";

export default function TermsAcceptanceBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  const handleAccept = () => {
    startTransition(async () => {
      await acceptTerms();
      setDismissed(true);
    });
  };

  return (
    <div className="fixed inset-x-0 bottom-16 md:bottom-0 z-[39] bg-[#0F0F0F] border-t border-white/10 shadow-2xl">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <FileText className="w-4 h-4 text-[#6699F3] shrink-0 hidden sm:block" />
        <p className="text-xs text-white/70 flex-1 min-w-0">
          Ao usar a plataforma, você concorda com nossos{" "}
          <Link
            href="/p/termos"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#6699F3] underline underline-offset-2 hover:text-white transition-colors font-medium"
          >
            Termos de Uso
          </Link>
          .
        </p>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <button
            onClick={handleAccept}
            disabled={isPending}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#6699F3] text-white text-xs font-semibold hover:bg-[#5580d4] disabled:opacity-60 transition-colors min-h-[36px]"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : null}
            Aceitar e continuar
          </button>
          <Link
            href="/p/termos"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-none flex items-center justify-center px-3 py-2 rounded-lg text-white/50 text-xs hover:text-white hover:bg-white/10 transition-colors min-h-[36px] border border-white/10"
          >
            Ler termos
          </Link>
        </div>
      </div>
    </div>
  );
}
