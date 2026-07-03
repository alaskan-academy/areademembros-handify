"use client";

import { useCallback, useEffect, useRef } from "react";
import { activeModalRef } from "@/lib/modal-back-state";

/**
 * Intercepta o botão voltar enquanto um modal está aberto.
 * Em vez de navegar para a página anterior, fecha o modal.
 * Coordena com BackButtonGuard para evitar conflito.
 *
 * Retorna `markNavigating()` — chame antes de navegar via Link dentro do modal
 * para evitar que o cleanup chame history.back() e cancele a navegação.
 */
export function useModalBackGuard(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  const closedByBackRef = useRef(false);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!isOpen) return;

    activeModalRef.current = true;
    closedByBackRef.current = false;
    // Guarda a URL atual para saber se houve navegação no cleanup.
    const urlOnOpen = window.location.href;
    history.pushState({ __handify_modal: true }, "");

    function handlePopState() {
      closedByBackRef.current = true;
      onCloseRef.current();
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      activeModalRef.current = false;
      // Se o modal fechou pelo X/backdrop (não pelo botão voltar) E a URL não
      // mudou (não houve navegação), remove o estado fantasma com history.back().
      // Se a URL mudou, o usuário navegou para outra página — não chamamos
      // history.back() para não anular a navegação.
      if (!closedByBackRef.current && window.location.href === urlOnOpen) {
        history.back();
      }
    };
  }, [isOpen]);

  // Chame antes de navegar por um Link dentro do modal — evita que o cleanup
  // chame history.back() concorrentemente com a navegação do Next.js.
  return useCallback(() => { closedByBackRef.current = true; }, []);
}
