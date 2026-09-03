import { Sparkles, ArrowRight } from "lucide-react";

/**
 * "Você já tem X de N cursos" — a oferta do Handify Completo como progresso,
 * não como banner.
 *
 * Quem tem 4 cursos gastou ~R$300 em partes; o Completo custa R$327. Mostrado
 * como "você já tem 4 de 23", o plano é um passo, não uma compra nova. Copy na
 * voz Handify: nunca "faltam 19", nunca "bloqueado". Só aparece para quem NÃO
 * tem o plano e já tem pelo menos um curso dele (quem tem zero vê a barra do
 * header). Contexto em .claude/plans/tiers-handify.md, fase 2.
 */
export default function PlanProgressCard({
  temDoPlano,
  totalDoPlano,
  linkUrl,
  buttonText,
}: {
  temDoPlano: number;
  totalDoPlano: number;
  linkUrl: string;
  buttonText?: string | null;
}) {
  if (totalDoPlano === 0 || temDoPlano === 0) return null;

  const restantes = Math.max(totalDoPlano - temDoPlano, 0);
  const pct = Math.min(Math.round((temDoPlano / totalDoPlano) * 100), 100);
  const maisDaMetade = temDoPlano * 2 >= totalDoPlano;

  return (
    <section
      className="handify-card relative overflow-hidden p-5 sm:p-6"
      aria-labelledby="plano-progresso-titulo"
    >
      <div className="brand-stripe absolute inset-x-0 top-0">
        <span />
        <span />
        <span />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#6699F3]">
            <Sparkles className="w-3.5 h-3.5" />
            Handify Completo
          </p>
          <h2 id="plano-progresso-titulo" className="text-lg sm:text-xl font-bold mt-1 leading-snug">
            Você já tem{" "}
            <span className="accent-word">
              {temDoPlano} de {totalDoPlano}
            </span>{" "}
            cursos do ateliê
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {maisDaMetade
              ? `Mais da metade já é sua. O Completo abre os outros ${restantes} — e todo curso novo entra sozinho.`
              : `O Completo abre os outros ${restantes} de uma vez — e todo curso novo entra sozinho.`}
          </p>

          <div
            className="mt-3 h-2 rounded-full bg-[#F5F5F0] overflow-hidden"
            role="progressbar"
            aria-valuenow={temDoPlano}
            aria-valuemin={0}
            aria-valuemax={totalDoPlano}
            aria-label={`${temDoPlano} de ${totalDoPlano} cursos do Handify Completo`}
          >
            <div
              className="h-full rounded-full bg-[#6699F3] handify-transition"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <a
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center justify-center gap-2 px-5 min-h-[44px] rounded-lg bg-[#6699F3] text-white text-sm font-semibold hover:bg-[#5580d4] handify-transition"
        >
          {buttonText || "Desbloquear o ateliê inteiro"}
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </section>
  );
}
