"use client";

import Link from "next/link";
import { StudentListModal } from "@/components/admin/metrics/StudentListModal";
import { type StudentBasic } from "@/components/admin/metrics/StudentMiniModal";

export type FunnelRowData = {
  courseId: string;
  title: string;
  enrolledCount: number;
  startedCount: number;
  q50Count: number;
  q75Count: number;
  certifiedCount: number;
  avgActivationDays: number | null;
  enrolledStudents: StudentBasic[];
  startedStudents: StudentBasic[];
  q50Students: StudentBasic[];
  q75Students: StudentBasic[];
  certifiedStudents: StudentBasic[];
};

export function FunnelTableClient({ rows }: { rows: FunnelRowData[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum curso com matrículas ainda.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-2 font-medium text-muted-foreground">Curso</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">Matrículas</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">Iniciaram</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">50%+</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">75%+</th>
            <th className="pb-2 font-medium text-muted-foreground text-right">Certificadas</th>
            <th className="pb-2 font-medium text-muted-foreground text-right whitespace-nowrap">
              Dias até 1ª aula
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((f) => {
            const pct = (n: number) =>
              f.enrolledCount > 0 ? Math.round((n / f.enrolledCount) * 100) : 0;
            return (
              <tr key={f.courseId}>
                <td className="py-3 pr-4 font-medium max-w-[200px]">
                  <Link
                    href={`/admin/cursos/${f.courseId}`}
                    className="truncate block hover:text-[#6699F3] transition-colors"
                    title={f.title}
                  >
                    {f.title}
                  </Link>
                </td>
                <ClickableCell
                  count={f.enrolledCount}
                  pct={pct(f.enrolledCount)}
                  students={f.enrolledStudents}
                  label={`Matrículas — ${f.title}`}
                  color="#6699F3"
                />
                <ClickableCell
                  count={f.startedCount}
                  pct={pct(f.startedCount)}
                  students={f.startedStudents}
                  label={`Iniciaram — ${f.title}`}
                  color="#6699F3"
                />
                <ClickableCell
                  count={f.q50Count}
                  pct={pct(f.q50Count)}
                  students={f.q50Students}
                  label={`50%+ concluído — ${f.title}`}
                  color="#72CF92"
                />
                <ClickableCell
                  count={f.q75Count}
                  pct={pct(f.q75Count)}
                  students={f.q75Students}
                  label={`75%+ concluído — ${f.title}`}
                  color="#FEC649"
                />
                <ClickableCell
                  count={f.certifiedCount}
                  pct={pct(f.certifiedCount)}
                  students={f.certifiedStudents}
                  label={`Certificadas — ${f.title}`}
                  color="#72CF92"
                  highlight
                />
                <td className="py-3 text-right tabular-nums text-muted-foreground text-xs">
                  {f.avgActivationDays !== null ? `${f.avgActivationDays}d` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ClickableCell({
  count,
  pct,
  students,
  label,
  color,
  highlight = false,
}: {
  count: number;
  pct: number;
  students: StudentBasic[];
  label: string;
  color: string;
  highlight?: boolean;
}) {
  if (count === 0) {
    return (
      <td className="py-3 pr-4 text-right tabular-nums">
        <span className="text-muted-foreground/40">0</span>
        <span className="text-xs text-muted-foreground/40 ml-1">(0%)</span>
      </td>
    );
  }

  return (
    <td className="py-3 pr-4 text-right tabular-nums">
      <StudentListModal
        title={label}
        subtitle={`${count} aluna${count !== 1 ? "s" : ""}`}
        students={students}
      >
        <span
          className={`cursor-pointer hover:underline${highlight ? " font-semibold" : ""}`}
          style={highlight ? { color } : undefined}
        >
          {count}
        </span>
      </StudentListModal>
      <span className="text-xs text-muted-foreground ml-1.5">({pct}%)</span>
    </td>
  );
}
