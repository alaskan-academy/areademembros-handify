"use client";

import { useEffect } from "react";
import FullPageMessage from "@/components/layout/FullPageMessage";

/**
 * Captura erros inesperados de qualquer página da plataforma.
 * `reset()` tenta renderizar a página de novo sem recarregar tudo — resolve
 * boa parte das falhas de rede momentâneas.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] erro nao tratado:", error);
  }, [error]);

  return (
    <FullPageMessage
      title="Algo deu errado aqui"
      description="Não foi nada que você fez. Tente abrir de novo — se continuar assim, é só chamar a gente."
    >
      <button
        type="button"
        onClick={reset}
        className="handify-transition inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#2D2D2D] px-5 text-base font-semibold text-white hover:bg-[#1f1f1f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6699F3]"
      >
        Tentar de novo
      </button>
    </FullPageMessage>
  );
}
