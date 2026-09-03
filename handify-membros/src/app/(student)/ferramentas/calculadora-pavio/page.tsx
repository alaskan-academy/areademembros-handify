import { getWickRecommendations, getSavedFormulas } from '@/lib/pavio/actions';
import { assertToolAccess } from '@/lib/ferramentas/access';
import CalculadoraPavio from '@/components/ferramentas/CalculadoraPavio';

export const metadata = {
  title: 'Calculadora de Pavio | Handify',
  description: 'Descubra qual pavio usar em cada vela. Responda 5 perguntas e receba a recomendação certa para sua cera, tamanho e fragrância.',
};

export default async function CalculadoraPavioPage() {
  // Sem isto o cadeado da lista seria só cosmético — bastava saber a URL.
  await assertToolAccess('calculadora-pavio');
  const [recommendations, savedFormulas] = await Promise.all([
    getWickRecommendations(),
    getSavedFormulas(),
  ]);

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#6699F3]/10 border border-[#6699F3]/20 flex items-center justify-center mx-auto text-2xl">
            🕯️
          </div>
          <h1 className="text-2xl font-black text-[#2D2D2D]">Calculadora de Pavio</h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Responda 5 perguntas e descubra qual pavio usar na sua vela, com alternativas e dicas de teste.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="bg-white border border-border/60 rounded-2xl px-4 py-3 text-xs text-muted-foreground leading-relaxed">
          💡 As recomendações são pontos de partida. <span className="font-semibold text-foreground">O teste de queima é obrigatório</span> antes de produzir em lote — cada marca de cera pode reagir de forma diferente.
        </div>

        {/* Wizard */}
        <div className="bg-white border border-border/60 rounded-3xl p-6 shadow-sm">
          <CalculadoraPavio
            recommendations={recommendations}
            savedFormulas={savedFormulas}
          />
        </div>
      </div>
    </div>
  );
}
