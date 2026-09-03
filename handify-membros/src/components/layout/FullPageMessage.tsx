import type { ReactNode } from "react";
import Image from "next/image";

const SUPPORT_URL = "https://wa.me/message/ZVYBKLSWPO7OM1";

/**
 * Tela cheia para quando a aluna não chega ao conteúdo — página inexistente
 * ou erro inesperado.
 *
 * Sem esta tela, o Next mostra a própria: fundo preto, texto em inglês e
 * nenhum caminho de volta. Aqui a aluna sempre tem para onde ir e como pedir
 * ajuda.
 *
 * Serve páginas server e client (`error.tsx` precisa ser client), por isso
 * não usa nenhuma API de servidor.
 */
export default function FullPageMessage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  /** Ações extras antes do botão de suporte — ex: "Tentar de novo". */
  children?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F0]">
      <div className="brand-stripe">
        <span /><span /><span />
      </div>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md flex flex-col items-center text-center gap-6">
          <Image
            src="/icon.png"
            alt=""
            width={64}
            height={64}
            priority
            unoptimized
            className="object-contain"
          />

          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#2D2D2D] text-balance">
              {title}
            </h1>
            <p className="text-base text-[#63635E] leading-relaxed">{description}</p>
          </div>

          <div className="w-full flex flex-col gap-3 pt-2">
            {children}

            {/*
              `<a>` em vez de `<Link>` de propósito: esta tela aparece quando
              algo quebrou. A navegação do Next reaproveita o estado do app —
              e é justamente esse estado que pode estar corrompido. Recarregar
              a página inteira garante que a aluna sai do erro.
            */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/cursos"
              className="handify-transition inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#6699F3] px-5 text-base font-semibold text-white hover:bg-[#5589e2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6699F3]"
            >
              Ir para meus cursos
            </a>

            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="handify-transition inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border-2 border-[#6699F3] px-5 text-base font-semibold text-[#6699F3] hover:bg-[#6699F3]/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6699F3]"
            >
              Falar com o suporte
            </a>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-[#888] border-t border-border/40">
        © {new Date().getFullYear()} Handify™ — Todos os direitos reservados
      </footer>
    </div>
  );
}
