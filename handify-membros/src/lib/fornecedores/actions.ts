'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import type {
  SupplierWithDetails, SupplierReviewWithProfile,
  SupplierSuggestionRow, FornecedorFiltros,
  NicheRow, ProductWithDetails, ProductReviewWithProfile,
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

// ── Nichos ────────────────────────────────────────────────────────────────────

export async function getNiches(): Promise<NicheRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('niches')
    .select('*')
    .eq('active', true)
    .order('position', { ascending: true })
  if (error) throw error
  return (data ?? []) as NicheRow[]
}

export async function adminGetNiches(): Promise<NicheRow[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('niches')
    .select('*')
    .order('position', { ascending: true })
  if (error) throw error
  return (data ?? []) as NicheRow[]
}

export async function adminUpsertNiche(niche: {
  id?: string
  name: string
  slug: string
  active: boolean
  position: number
}): Promise<{ id: string }> {
  const supabase = createServiceClient()
  const { id, ...fields } = niche
  const { data, error } = id
    ? await supabase.from('niches').update(fields).eq('id', id).select('id').single()
    : await supabase.from('niches').insert(fields).select('id').single()
  if (error) throw error
  revalidatePath('/ferramentas/fornecedores')
  revalidatePath('/admin/fornecedores')
  return { id: data.id }
}

export async function adminDeleteNiche(id: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('niches').delete().eq('id', id)
  revalidatePath('/ferramentas/fornecedores')
  revalidatePath('/admin/fornecedores')
}

// ── Produtos ─────────────────────────────────────────────────────────────────

export async function getProducts(nicheId?: string, courseId?: string, userId?: string): Promise<ProductWithDetails[]> {
  const supabase = await createClient()

  // Resolve product IDs por filtro de nicho e/ou curso
  let productIds: string[] | null = null

  if (courseId) {
    const { data: links } = await supabase
      .from('product_course_links')
      .select('product_id')
      .eq('course_id', courseId)
    const ids = (links ?? []).map((l: any) => l.product_id)
    if (ids.length === 0) return []
    productIds = ids
  }

  if (nicheId) {
    const { data: links } = await supabase
      .from('product_niche_links')
      .select('product_id')
      .eq('niche_id', nicheId)
    const ids = (links ?? []).map((l: any) => l.product_id)
    if (ids.length === 0) return []
    // Interseção: produto precisa estar em ambos (nicho E curso, se ambos ativos)
    productIds = productIds
      ? productIds.filter(id => ids.includes(id))
      : ids
    if (productIds.length === 0) return []
  }

  let query = supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true })

  if (productIds) query = query.in('id', productIds)

  const { data: productsRaw, error } = await query
  if (error) throw error
  if (!productsRaw || productsRaw.length === 0) return []

  const ids = productsRaw.map((p: any) => p.id)

  const [{ data: supplierLinks }, { data: courseLinks }, { data: favs }, { data: reviewCounts }] = await Promise.all([
    supabase
      .from('product_supplier_links')
      .select('*, suppliers(id, name, logo_url, verified, supplier_tags(tag), supplier_channels(channel, url))')
      .in('product_id', ids)
      .order('position', { ascending: true }),
    supabase
      .from('product_course_links')
      .select('product_id, course_id')
      .in('product_id', ids),
    userId
      ? supabase.from('product_favorites').select('product_id').eq('user_id', userId)
      : Promise.resolve({ data: [] }),
    supabase
      .from('product_reviews')
      .select('product_id')
      .in('product_id', ids)
      .eq('approved', true),
  ])

  const favSet = new Set((favs ?? []).map((f: any) => f.product_id))
  const countMap: Record<string, number> = {}
  for (const r of reviewCounts ?? []) {
    countMap[(r as any).product_id] = (countMap[(r as any).product_id] ?? 0) + 1
  }

  return productsRaw.map((p: any) => ({
    ...p,
    suppliers: (supplierLinks ?? [])
      .filter((l: any) => l.product_id === p.id)
      .map((l: any) => ({
        ...l,
        supplier: {
          ...l.suppliers,
          tags:     (l.suppliers?.supplier_tags    ?? []).map((t: any) => t.tag),
          channels: (l.suppliers?.supplier_channels ?? []).map((c: any) => ({ channel: c.channel, url: c.url })),
        },
      })),
    course_ids:  (courseLinks ?? []).filter((l: any) => l.product_id === p.id).map((l: any) => l.course_id),
    isFavorite:  favSet.has(p.id),
    reviewCount: countMap[p.id] ?? 0,
  })) as ProductWithDetails[]
}

export async function toggleProductFavorite(
  userId: string,
  productId: string,
  isFavorite: boolean
): Promise<void> {
  const supabase = await createClient()
  if (isFavorite) {
    await supabase.from('product_favorites').delete()
      .eq('user_id', userId).eq('product_id', productId)
  } else {
    await supabase.from('product_favorites').insert({ user_id: userId, product_id: productId })
  }
  revalidatePath('/ferramentas/fornecedores')
}

export async function getProductReviews(productId: string): Promise<ProductReviewWithProfile[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('product_reviews')
    .select('*, profiles(full_name, avatar_url)')
    .eq('product_id', productId)
    .eq('approved', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProductReviewWithProfile[]
}

export async function submitProductReview(
  userId: string,
  productId: string,
  body: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('product_reviews').upsert({
    user_id:    userId,
    product_id: productId,
    body:       body.trim(),
    approved:   false,
  }, { onConflict: 'product_id,user_id' })
  if (error) return { error: error.message }
  return {}
}

export async function adminGetProductReviews(approved?: boolean) {
  const supabase = createServiceClient()
  let q = supabase
    .from('product_reviews')
    .select('*, profiles(full_name, avatar_url), products(name)')
    .order('created_at', { ascending: false })
  if (approved !== undefined) q = q.eq('approved', approved)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function adminApproveProductReview(id: string, approved: boolean): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('product_reviews').update({ approved }).eq('id', id)
  revalidatePath('/ferramentas/fornecedores')
  revalidatePath('/admin/fornecedores/comentarios')
}

export async function adminDeleteProductReview(id: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('product_reviews').delete().eq('id', id)
  revalidatePath('/ferramentas/fornecedores')
  revalidatePath('/admin/fornecedores/comentarios')
}

export async function adminGetProducts(): Promise<ProductWithDetails[]> {
  const supabase = createServiceClient()

  const { data: productsRaw, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  if (!productsRaw || productsRaw.length === 0) return []

  const ids = productsRaw.map((p: any) => p.id)

  const [{ data: supplierLinks }, { data: courseLinks }] = await Promise.all([
    supabase
      .from('product_supplier_links')
      .select('*, suppliers(id, name, logo_url, verified, supplier_tags(tag), supplier_channels(channel, url))')
      .in('product_id', ids)
      .order('position', { ascending: true }),
    supabase
      .from('product_course_links')
      .select('product_id, course_id')
      .in('product_id', ids),
  ])

  return productsRaw.map((p: any) => ({
    ...p,
    suppliers: (supplierLinks ?? [])
      .filter((l: any) => l.product_id === p.id)
      .map((l: any) => ({
        ...l,
        supplier: {
          ...l.suppliers,
          tags:     (l.suppliers?.supplier_tags    ?? []).map((t: any) => t.tag),
          channels: (l.suppliers?.supplier_channels ?? []).map((c: any) => ({ channel: c.channel, url: c.url })),
        },
      })),
    course_ids: (courseLinks ?? [])
      .filter((l: any) => l.product_id === p.id)
      .map((l: any) => l.course_id),
  })) as ProductWithDetails[]
}

export async function adminUpsertProduct(product: {
  id?: string
  name: string
  image_url: string
  active: boolean
  course_ids: string[]
  supplier_links: { supplier_id: string; buy_url: string; position: number }[]
}): Promise<{ id: string }> {
  const supabase = createServiceClient()
  const { id, course_ids, supplier_links, ...fields } = product

  const { data, error } = id
    ? await supabase.from('products').update(fields).eq('id', id).select('id').single()
    : await supabase.from('products').insert(fields).select('id').single()
  if (error) throw error
  const productId = data.id

  await supabase.from('product_course_links').delete().eq('product_id', productId)
  await supabase.from('product_supplier_links').delete().eq('product_id', productId)

  if (course_ids.length > 0) {
    await supabase.from('product_course_links').insert(
      course_ids.map(course_id => ({ product_id: productId, course_id }))
    )
  }
  if (supplier_links.length > 0) {
    await supabase.from('product_supplier_links').insert(
      supplier_links.filter(l => l.buy_url).map(l => ({ product_id: productId, ...l }))
    )
  }

  revalidatePath('/ferramentas/fornecedores')
  revalidatePath('/admin/fornecedores/produtos')
  return { id: productId }
}

export async function adminDeleteProduct(id: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('products').delete().eq('id', id)
  revalidatePath('/ferramentas/fornecedores')
  revalidatePath('/admin/fornecedores/produtos')
}
