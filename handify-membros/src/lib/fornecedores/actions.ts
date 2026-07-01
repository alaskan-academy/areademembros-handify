'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import type {
  SupplierWithDetails, SupplierReviewWithProfile,
  SupplierSuggestionRow, FornecedorFiltros,
} from './types'

// ── Student actions ───────────────────────────────────────────────────────────

export async function getSuppliers(
  userId: string,
  filtros: Partial<FornecedorFiltros> = {}
): Promise<SupplierWithDetails[]> {
  const supabase = await createClient()

  // Base query com channels e tags
  let query = supabase
    .from('suppliers')
    .select(`
      *,
      supplier_channels (*),
      supplier_tags (tag)
    `)
    .eq('active', true)
    .order('name', { ascending: true })

  const rows = await query
  if (rows.error) throw rows.error

  // Buscar favoritos do usuário
  const { data: favs } = await supabase
    .from('supplier_favorites')
    .select('supplier_id')
    .eq('user_id', userId)

  const favSet = new Set((favs ?? []).map(f => f.supplier_id))

  // Buscar contagem de comentários aprovados por fornecedor
  const { data: reviewCounts } = await supabase
    .from('supplier_reviews')
    .select('supplier_id')
    .eq('approved', true)

  const countMap: Record<string, number> = {}
  for (const r of reviewCounts ?? []) {
    countMap[r.supplier_id] = (countMap[r.supplier_id] ?? 0) + 1
  }

  let suppliers: SupplierWithDetails[] = (rows.data ?? []).map((s: any) => ({
    ...s,
    channels:    s.supplier_channels ?? [],
    tags:        (s.supplier_tags ?? []).map((t: any) => t.tag),
    isFavorite:  favSet.has(s.id),
    reviewCount: countMap[s.id] ?? 0,
  }))

  // Filtro local (mais simples que múltiplos joins — lista pequena)
  const { produto, categoria, canal, busca } = filtros

  if (produto)   suppliers = suppliers.filter(s => s.tags.includes(produto))
  if (categoria) suppliers = suppliers.filter(s => s.tags.includes(categoria))
  if (canal)     suppliers = suppliers.filter(s => s.channels.some(c => c.channel === canal))
  if (busca) {
    const q = busca.toLowerCase()
    suppliers = suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.description ?? '').toLowerCase().includes(q)
    )
  }

  return suppliers
}

export async function toggleFavorite(
  userId: string,
  supplierId: string,
  isFavorite: boolean
): Promise<void> {
  const supabase = await createClient()
  if (isFavorite) {
    await supabase.from('supplier_favorites').delete()
      .eq('user_id', userId).eq('supplier_id', supplierId)
  } else {
    await supabase.from('supplier_favorites').insert({ user_id: userId, supplier_id: supplierId })
  }
  revalidatePath('/ferramentas/fornecedores')
}

export async function getSupplierReviews(supplierId: string): Promise<SupplierReviewWithProfile[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('supplier_reviews')
    .select('*, profiles(full_name, avatar_url)')
    .eq('supplier_id', supplierId)
    .eq('approved', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SupplierReviewWithProfile[]
}

export async function submitReview(
  userId: string,
  supplierId: string,
  body: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('supplier_reviews').upsert({
    user_id: userId,
    supplier_id: supplierId,
    body: body.trim(),
    approved: false,
  }, { onConflict: 'supplier_id,user_id' })
  if (error) return { error: error.message }
  return {}
}

export async function submitSuggestion(
  userId: string,
  data: { name: string; url: string; what_they_sell: string; notes: string }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('supplier_suggestions').insert({
    user_id: userId,
    ...data,
  })
  if (error) return { error: error.message }
  return {}
}

// ── Admin actions ─────────────────────────────────────────────────────────────

export async function adminGetSuppliers() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('suppliers')
    .select('*, supplier_channels(*), supplier_tags(tag)')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function adminUpsertSupplier(supplier: {
  id?: string
  name: string
  description: string
  logo_url: string
  verified: boolean
  active: boolean
  position?: number
  channels: { channel: string; url: string }[]
  tags: string[]
}): Promise<{ id: string }> {
  const supabase = createServiceClient()
  const { id, channels, tags, ...fields } = supplier

  const { data, error } = id
    ? await supabase.from('suppliers').update(fields).eq('id', id).select('id').single()
    : await supabase.from('suppliers').insert(fields).select('id').single()
  if (error) throw error
  const supplierId = data.id

  // Replace channels and tags
  await supabase.from('supplier_channels').delete().eq('supplier_id', supplierId)
  await supabase.from('supplier_tags').delete().eq('supplier_id', supplierId)

  if (channels.length > 0) {
    await supabase.from('supplier_channels').insert(
      channels.filter(c => c.url).map(c => ({ supplier_id: supplierId, ...c }))
    )
  }
  if (tags.length > 0) {
    await supabase.from('supplier_tags').insert(
      tags.map(tag => ({ supplier_id: supplierId, tag }))
    )
  }

  revalidatePath('/ferramentas/fornecedores')
  revalidatePath('/admin/fornecedores')
  return { id: supplierId }
}

export async function adminDeleteSupplier(id: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('suppliers').delete().eq('id', id)
  revalidatePath('/ferramentas/fornecedores')
  revalidatePath('/admin/fornecedores')
}

export async function adminGetReviews(approved?: boolean) {
  const supabase = createServiceClient()
  let q = supabase
    .from('supplier_reviews')
    .select('*, profiles(full_name, avatar_url), suppliers(name)')
    .order('created_at', { ascending: false })
  if (approved !== undefined) q = q.eq('approved', approved)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function adminApproveReview(id: string, approved: boolean): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('supplier_reviews').update({ approved }).eq('id', id)
  revalidatePath('/ferramentas/fornecedores')
  revalidatePath('/admin/fornecedores/comentarios')
}

export async function adminDeleteReview(id: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('supplier_reviews').delete().eq('id', id)
  revalidatePath('/ferramentas/fornecedores')
  revalidatePath('/admin/fornecedores/comentarios')
}

export async function adminGetSuggestions(): Promise<SupplierSuggestionRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('supplier_suggestions')
    .select('*, profiles(full_name, avatar_url)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SupplierSuggestionRow[]
}

export async function adminUpdateSuggestionStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected',
  admin_notes?: string
): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('supplier_suggestions').update({ status, admin_notes }).eq('id', id)
  revalidatePath('/admin/fornecedores/sugestoes')
}
