"use client";

import { useEffect, useRef } from "react";
import { activeModalRef } from "@/lib/modal-back-state";

/**
 * Intercepta o botão voltar enquanto um modal está aberto.
 * Em vez de navegar para a página anterior, fecha o modal.
 * Coordena com BackButtonGuard para evitar conflito.
 */
export function useModalBackGuard(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  const closedByBackRef = useRef(false);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!isOpen) return;

    activeModalRef.current = true;
    closedByBackRef.current = false;
    history.pushState({ __handify_modal: true }, "");

    function handlePopState() {
      closedByBackRef.current = true;
      onCloseRef.current();
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      activeModalRef.current = false;
      // Se o modal fechou pelo X/backdrop (não pelo botão voltar),
      // precisamos remover o estado que pushamos para não deixar entrada fantasma.
      if (!closedByBackRef.current) {
        history.back();
      }
    };
  }, [isOpen]);
}
