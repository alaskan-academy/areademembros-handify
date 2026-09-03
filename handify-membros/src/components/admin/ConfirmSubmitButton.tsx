"use client";

import type { ReactNode } from "react";

/**
 * Botão de submit que pergunta antes de enviar.
 *
 * Existe porque as filas de moderação tinham "aprovar" e "excluir" colados,
 * ambos com ~26px: um toque errado apagava a avaliação de uma aluna para
 * sempre, sem nenhuma pergunta.
 */
export default function ConfirmSubmitButton({
  pergunta,
  title,
  className,
  children,
}: {
  /** Texto da confirmação. Diga o que será perdido, não só "tem certeza?". */
  pergunta: string;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      title={title}
      className={className}
      onClick={(e) => {
        if (!window.confirm(pergunta)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
