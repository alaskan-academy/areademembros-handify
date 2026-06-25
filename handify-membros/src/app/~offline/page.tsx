"use client";

import Image from "next/image";

export default function OfflinePage() {
  return (
    <div
      className="min-h-svh bg-[#F5F5F0] flex flex-col"
      style={{ fontFamily: "var(--font-montserrat), Montserrat, Arial, sans-serif" }}
    >
      {/* Faixa tricolor topo */}
      <div className="flex h-1.5 w-full shrink-0">
        <span className="flex-1 bg-[#6699F3]" />
        <span className="flex-1 bg-[#72CF92]" />
        <span className="flex-1 bg-[#FEC649]" />
      </div>

      {/* Conteúdo central */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <Image
          src="/logo-vertical-azul.png"
          alt="Handify"
          width={110}
          height={85}
          priority
          unoptimized
        />

        <div className="mt-10 space-y-3 max-w-sm">
          <h1 className="text-xl font-bold text-[#2D2D2D]">
            Você está{" "}
            <span className="text-[#6699F3]">sem conexão</span>
          </h1>
          <p className="text-sm text-[#2D2D2D]/60 leading-relaxed">
            Parece que a internet sumiu por aqui. Verifique sua conexão e tente
            novamente — seus cursos estarão te esperando!
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-10 inline-flex items-center gap-2 rounded-lg bg-[#6699F3] px-6 py-3 text-sm font-semibold text-white min-h-[44px] transition-opacity hover:opacity-90 active:opacity-75"
        >
          Tentar novamente
        </button>
      </div>

      {/* Rodapé */}
      <div className="pb-6 text-center text-xs text-[#2D2D2D]/30 tracking-wide uppercase">
        Handify™ · Um espaço feito para aprender e criar.
      </div>

      {/* Faixa tricolor rodapé */}
      <div className="flex h-1.5 w-full shrink-0">
        <span className="flex-1 bg-[#6699F3]" />
        <span className="flex-1 bg-[#72CF92]" />
        <span className="flex-1 bg-[#FEC649]" />
      </div>
    </div>
  );
}
