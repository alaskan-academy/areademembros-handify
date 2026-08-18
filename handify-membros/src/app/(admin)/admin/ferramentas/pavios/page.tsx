import { createClient } from '@/lib/supabase/server';
import WickRecsTable from './WickRecsTable';
import type { WickRecommendation } from '@/lib/pavio/types';

export const metadata = { title: 'Recomendações de Pavio | Admin Handify' };

export default async function AdminPaviosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('wick_recommendations')
    .select('*')
    .order('candle_type')
    .order('wax_type')
    .order('diameter_min');

  const recs = (data as WickRecommendation[]) ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">Recomendações de Pavio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {recs.length} recomendações · usadas pela Calculadora de Pavio das alunas
          </p>
        </div>
      </div>
      <WickRecsTable recs={recs} />
    </div>
  );
}
