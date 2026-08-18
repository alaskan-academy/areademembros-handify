'use server';

import { createClient } from '@/lib/supabase/server';
import type { WickRecommendation, SavedWickFormula } from './types';

export async function getWickRecommendations(): Promise<WickRecommendation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('wick_recommendations')
    .select('*')
    .eq('active', true)
    .order('priority');
  return (data as WickRecommendation[]) ?? [];
}

export async function getSavedFormulas(): Promise<SavedWickFormula[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('saved_wick_formulas')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  return (data as SavedWickFormula[]) ?? [];
}

export async function saveWickFormula(input: {
  name: string;
  candle_type: string;
  wax_type: string;
  diameter: number;
  fragrance_pct: number;
  has_dye: boolean;
  mold_shape: string | null;
  wick_primary: string;
  wick_alternatives: string[];
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Não autenticado' };

  const { data, error } = await supabase
    .from('saved_wick_formulas')
    .insert({ ...input, user_id: user.id })
    .select('id')
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, id: data?.id };
}

export async function deleteWickFormula(id: string): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };
  await supabase.from('saved_wick_formulas').delete().eq('id', id).eq('user_id', user.id);
  return { success: true };
}

export async function updateTestNotes(id: string, test_notes: string): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };
  await supabase
    .from('saved_wick_formulas')
    .update({ test_notes, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);
  return { success: true };
}
