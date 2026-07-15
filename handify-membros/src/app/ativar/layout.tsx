import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AtivarLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F0]">
      <div className="brand-stripe">
        <span /><span /><span />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
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
            <span className="text-xs text-[#888] tracking-wide">
              Um espaço feito para aprender e criar.
            </span>
          </div>

          {children}
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-[#888] border-t border-border/40">
        © {new Date().getFullYear()} Handify™ — Todos os direitos reservados
      </footer>
    </div>
  );
}
