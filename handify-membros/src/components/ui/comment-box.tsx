"use client";

import { useEffect, useRef } from "react";

/**
 * Campo de comentário que cresce conforme o texto.
 *
 * Os campos anteriores eram de uma linha só: no fórum, um `rows={1}` travado
 * em 44px; nas inspirações, um `<input>`. Quem escrevia um comentário longo
 * enxergava uma fatia do que tinha escrito e não conseguia reler antes de
 * enviar — e o limite é de 2.000 caracteres.
 *
 * Cresce até `alturaMaxima` e então rola internamente, para não empurrar o
 * botão de enviar para fora da tela no celular.
 */
export default function CommentBox({
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel,
  maxLength = 2000,
  autoFocus,
  alturaMinima = 44,
  alturaMaxima = 160,
  className = "",
}: {
  value: string;
  onChange: (valor: string) => void;
  /** Chamado no Enter sem Shift. Shift+Enter quebra linha. */
  onSubmit?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  maxLength?: number;
  autoFocus?: boolean;
  alturaMinima?: number;
  alturaMaxima?: number;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Recalcula a altura sempre que o texto muda — inclusive quando é limpo
  // depois do envio, senão o campo ficaria alto e vazio.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, alturaMinima), alturaMaxima)}px`;
  }, [value, alturaMinima, alturaMaxima]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (onSubmit && e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSubmit();
        }
      }}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      maxLength={maxLength}
      autoFocus={autoFocus}
      rows={1}
      style={{ minHeight: alturaMinima, maxHeight: alturaMaxima }}
      className={`flex-1 resize-none overflow-y-auto rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-relaxed transition-shadow placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 ${className}`}
    />
  );
}
