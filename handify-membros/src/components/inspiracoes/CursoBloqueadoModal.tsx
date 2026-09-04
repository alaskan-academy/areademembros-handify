'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { X, Lock, ArrowRight } from 'lucide-react'
import { useModalBackGuard } from '@/hooks/useModalBackGuard'
import type { CursoDoFiltro } from '@/lib/inspiracoes/types'

/**
 * Aluna tocou num curso do filtro que ela não tem. Em vez de sumir o curso da
 * lista (ela nem saberia que existe conteúdo ali), o chip aparece em cinza com
 * cadeado e abre este aviso, com o caminho para comprar.
 */
export function CursoBloqueadoModal({ curso, onClose }: { curso: CursoDoFiltro; onClose: () => void }) {
  const fundoRef = useRef<HTMLDivElement>(null)
  useModalBackGuard(true, onClose)

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', tecla)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const preco =
    curso.price != null && curso.price > 0
      ? curso.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : null

  return (
    <div
      ref={fundoRef}
      onClick={e => { if (e.target === fundoRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${curso.title} — você ainda não tem este curso`}
    >
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl">
        <div className="brand-stripe"><span /><span /><span /></div>

        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 p-1.5 rounded-full text-foreground/40 hover:text-foreground hover:bg-muted transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-6 py-7 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#6699F3]/10 border border-[#6699F3]/20 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-[#6699F3]" />
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#0F0F0F] leading-tight">
              Você ainda não tem este curso
            </h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              As receitas e dicas de <strong className="text-foreground">{curso.title}</strong> ficam guardadas para
              quem faz o curso. Com ele, este filtro abre e o conteúdo aparece aqui.
            </p>
          </div>

          {preco && (
            <p className="text-sm">
              <span className="text-muted-foreground">O curso sai por </span>
              <strong className="text-[#2D2D2D]">{preco}</strong>
            </p>
          )}

          <div className="space-y-2 pt-1">
            {curso.checkoutUrl ? (
              <a
                href={curso.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex items-center justify-center gap-2 w-full min-h-[52px] rounded-xl bg-[#6699F3] text-white font-bold text-sm hover:bg-[#5580d4] handify-transition"
              >
                Quero este curso <ArrowRight className="w-4 h-4" />
              </a>
            ) : (
              <Link
                href={`/cursos/${curso.slug}`}
                onClick={onClose}
                className="flex items-center justify-center gap-2 w-full min-h-[52px] rounded-xl bg-[#6699F3] text-white font-bold text-sm hover:bg-[#5580d4] handify-transition"
              >
                Ver o curso <ArrowRight className="w-4 h-4" />
              </Link>
            )}

            <Link
              href={`/cursos/${curso.slug}`}
              onClick={onClose}
              className="block w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Ver o que tem dentro do curso
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
