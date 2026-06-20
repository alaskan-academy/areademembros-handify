"use client";

import { useState } from "react";
import { DollarSign, ShoppingBag, X, Award, ExternalLink } from "lucide-react";
import Image from "next/image";

export type CourseEnroll = {
  courseId: string;
  courseTitle: string;
  price: number | null;
  source: string;
  grantedAt: string;
};

export type StudentRow = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  totalSpent: number;
  buyCount: number;
};

function Avatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 text-white font-semibold"
      style={{ width: size, height: size, background: "#6699F3", fontSize: size * 0.35 }}
    >
      {initials || "?"}
    </div>
  );
}

function fmtBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function sourceLabel(source: string) {
  const map: Record<string, string> = {
    payt: "Payt",
    manual: "Manual",
    subscription: "Assinatura",
  };
  return map[source] ?? source;
}

function sourceColor(source: string) {
  if (source === "payt") return "#6699F3";
  if (source === "subscription") return "#72CF92";
  return "#2D2D2D";
}

export function FinancialRankings({
  topBySpent,
  topByBuys,
  enrollmentsByUserId,
}: {
  topBySpent: StudentRow[];
  topByBuys: StudentRow[];
  enrollmentsByUserId: Record<string, CourseEnroll[]>;
}) {
  const [selected, setSelected] = useState<StudentRow | null>(null);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Maior gasto */}
        <RankCard
          title="Maior gasto total"
          subtitle="por valor pago em cursos (Payt)"
          icon={DollarSign}
          color="#72CF92"
          items={topBySpent}
          medals={medals}
          valueLabel={(s) => fmtBRL(s.totalSpent)}
          onSelect={setSelected}
        />

        {/* Mais compras */}
        <RankCard
          title="Mais compras"
          subtitle="por quantidade de cursos adquiridos via Payt"
          icon={ShoppingBag}
          color="#6699F3"
          items={topByBuys}
          medals={medals}
          valueLabel={(s) => `${s.buyCount} curso${s.buyCount !== 1 ? "s" : ""}`}
          onSelect={setSelected}
        />
      </div>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="handify-card w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-border">
              <Avatar name={selected.name} url={selected.avatar} size={44} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{selected.name}</p>
                <p className="text-xs text-muted-foreground truncate">{selected.email}</p>
              </div>
              <div className="text-right shrink-0 mr-2">
                <p className="text-xs text-muted-foreground">Total gasto</p>
                <p className="font-bold text-[#72CF92]">{fmtBRL(selected.totalSpent)}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors shrink-0"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cursos */}
            <div className="overflow-y-auto flex-1 p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                Cursos matriculados
              </p>
              {(enrollmentsByUserId[selected.id] ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem matrículas registradas.</p>
              ) : (
                <div className="space-y-2">
                  {(enrollmentsByUserId[selected.id] ?? [])
                    .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt))
                    .map((e) => (
                      <div
                        key={e.courseId}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50"
                      >
                        <Award className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{e.courseTitle}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(e.grantedAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {e.price && e.source === "payt" ? (
                            <p className="text-sm font-semibold" style={{ color: "#72CF92" }}>
                              {fmtBRL(e.price)}
                            </p>
                          ) : null}
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{
                              background: sourceColor(e.source) + "18",
                              color: sourceColor(e.source),
                            }}
                          >
                            {sourceLabel(e.source)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RankCard({
  title, subtitle, icon: Icon, color, items, medals, valueLabel, onSelect,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  items: StudentRow[];
  medals: string[];
  valueLabel: (s: StudentRow) => string;
  onSelect: (s: StudentRow) => void;
}) {
  return (
    <div className="handify-card p-6">
      <h2 className="font-semibold mb-0.5 flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color }} />
        {title}
      </h2>
      <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum dado ainda.</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((student, i) => (
            <button
              key={student.id}
              onClick={() => onSelect(student)}
              className="w-full flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/60 transition-colors text-left group"
            >
              <span className="text-base w-6 shrink-0 text-center">
                {medals[i] ?? <span className="text-xs text-muted-foreground font-bold">{i + 1}</span>}
              </span>
              <Avatar name={student.name} url={student.avatar} size={32} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{student.name}</p>
                <p className="text-xs text-muted-foreground truncate">{student.email}</p>
              </div>
              <span
                className="text-xs font-semibold px-2 py-1 rounded-full shrink-0 flex items-center gap-1"
                style={{ background: color + "20", color }}
              >
                {valueLabel(student)}
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
