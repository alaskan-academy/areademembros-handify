'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (data?.role !== 'admin') throw new Error('Acesso negado');
  return supabase;
}

export type WickRecInput = {
  candle_type: 'container' | 'mold';
  wax_type: string;
  diameter_min: number;
  diameter_max: number;
  fragrance_min: number;
  fragrance_max: number;
  has_dye: boolean | null;
  mold_shape: string | null;
  wick_primary: string;
  wick_alternatives: string[];
  notes: string | null;
  course_lesson_id: string | null;
  priority: number;
  active: boolean;
};

export async function createWickRec(input: WickRecInput) {
  const supabase = await assertAdmin();
  const { error } = await supabase.from('wick_recommendations').insert(input);
  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/ferramentas/pavios');
  return { success: true };
}

export async function updateWickRec(id: string, input: Partial<WickRecInput>) {
  const supabase = await assertAdmin();
  const { error } = await supabase.from('wick_recommendations').update(input).eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/ferramentas/pavios');
  return { success: true };
}

export async function toggleWickRec(id: string, active: boolean) {
  const supabase = await assertAdmin();
  const { error } = await supabase.from('wick_recommendations').update({ active }).eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/ferramentas/pavios');
  return { success: true };
}

export async function deleteWickRec(id: string) {
  const supabase = await assertAdmin();
  const { error } = await supabase.from('wick_recommendations').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidatePath('/admin/ferramentas/pavios');
  return { success: true };
}
