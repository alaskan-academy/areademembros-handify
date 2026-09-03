"use client";

import { useEffect, useState, useTransition } from "react";
import { Award, Loader2 } from "lucide-react";
import {
  contarCertificadosPendentes,
  emitirCertificadosPendentes,
} from "@/app/(admin)/admin/cursos/certificados-actions";

/**
 * Aparece quando um curso tem alunas que já concluíram mas estão sem
 * certificado — o caso de ligar "Concede certificado" depois que gente já
 * terminou. O certificado normalmente sai no momento em que a aula é marcada
 * como concluída, então quem terminou antes não recebe nada sozinha.
 */
export default function CertificadosPendentes({ courseId }: { courseId: string }) {
  const [pendentes, setPendentes] = useState<number | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  useEffect(() => {
    let ativo = true;
    contarCertificadosPendentes(courseId)
      .then((n) => ativo && setPendentes(n))
      .catch(() => ativo && setPendentes(0));
    return () => {
      ativo = false;
    };
  }, [courseId]);

  if (pendentes === null || pendentes === 0) return null;

  const plural = pendentes > 1;

  function emitir() {
    const ok = window.confirm(
      `Emitir ${pendentes} certificado${plural ? "s" : ""} e avisar ${plural ? "as alunas" : "a aluna"} por e-mail?`
    );
    if (!ok) return;

    startTransition(async () => {
      const r = await emitirCertificadosPendentes(courseId);
      setResultado(
        r.falharam > 0
          ? `${r.emitidos} emitido(s), ${r.falharam} falharam — veja os logs.`
          : `${r.emitidos} certificado(s) emitido(s) e e-mail enviado.`
      );
      setPendentes(0);
    });
  }

  return (
    <div className="rounded-lg border border-[#FEC649]/40 bg-[#FEC649]/10 p-4 space-y-2">
      <div className="flex items-start gap-2.5">
        <Award className="w-4 h-4 mt-0.5 shrink-0 text-[#9a7100]" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[#2D2D2D]">
            {pendentes} aluna{plural ? "s" : ""} concluí{plural ? "ram" : "u"} sem certificado
          </p>
          <p className="text-xs text-[#2D2D2D]/70 leading-relaxed">
            Elas terminaram antes de o certificado ser ativado neste curso. O certificado
            só sai quando uma aula é marcada como concluída, então precisam ser emitidos
            aqui.
          </p>
        </div>
      </div>

      {resultado ? (
        <p className="text-xs font-medium text-[#2F7D4F]">{resultado}</p>
      ) : (
        <button
          type="button"
          onClick={emitir}
          disabled={enviando}
          className="handify-transition inline-flex min-h-[36px] items-center gap-2 rounded-lg bg-[#6699F3] px-4 text-sm font-semibold text-white hover:bg-[#5589e2] disabled:opacity-60"
        >
          {enviando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {enviando ? "Emitindo…" : `Emitir e avisar por e-mail`}
        </button>
      )}
    </div>
  );
}
