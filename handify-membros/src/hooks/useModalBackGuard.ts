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
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!isOpen) return;

    activeModalRef.current = true;
    history.pushState({ __handify_modal: true }, "");

    function handlePopState() {
      onCloseRef.current();
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      activeModalRef.current = false;
    };
  }, [isOpen]);
}
