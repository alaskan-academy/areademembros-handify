import type { ReactNode } from "react";
import Image from "next/image";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F0]">
      {/* Faixa tricolor Handify no topo */}
      <div className="brand-stripe">
        <span /><span /><span />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Logo Handify */}
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/logo-vertical-azul.png"
              alt="Handify™"
              width={140}
              height={140}
              priority
              unoptimized
              className="object-contain"
            />
            <span className="text-xs text-muted-foreground tracking-wide">
              Um espaço feito para aprender e criar.
            </span>
          </div>

          {children}
        </div>
      </div>

      {/* Rodapé */}
      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border/40">
        © {new Date().getFullYear()} Handify™ — Todos os direitos reservados
      </footer>
    </div>
  );
}
