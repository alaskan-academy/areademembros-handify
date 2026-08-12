"use client";

import Link from "next/link";
import { Map } from "lucide-react";
import { ONBOARDING_SECTIONS } from "@/lib/onboarding/sections";

interface Props {
  visitedSections: Record<string, boolean>;
}

export default function DiscoveryCard({ visitedSections }: Props) {
  const pending = ONBOARDING_SECTIONS.filter(
    (s) => !visitedSections[s.id] && !s.prefix
  );

  if (pending.length === 0) return null;

  return (
    <div className="handify-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Map className="h-4 w-4 text-[#6699F3] shrink-0" />
        <h2 className="text-sm font-semibold text-foreground">
          Explore a plataforma
        </h2>
        <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-[#6699F3]/10 text-[#6699F3]">
          {pending.length} novo{pending.length > 1 ? "s" : ""}
        </span>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Você ainda não visitou estas seções. Clique para conhecer cada uma.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {pending.map((section) => (
          <Link
            key={section.id}
            href={section.rota}
            className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-sm font-medium text-foreground/75 hover:text-[#6699F3] hover:border-[#6699F3]/30 hover:bg-[#6699F3]/5 transition-colors min-h-[44px]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#6699F3] animate-pulse shrink-0" />
            {section.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
