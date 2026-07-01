'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import type {
  InspiracaoPost,
  InspiracaoComment,
  InspiracaoFiltros,
  InspiracaoCursor,
  InspiracaoPage,
  UpsertInspiracaoPayload,
} from './types'

const PAGE_SIZE = 12

// ── Feed (alunas) ─────────────────────────────────────────────────────────────

export async function getInspiracoesFeed(
  userId: string,
  filtros: InspiracaoFiltros = {},
  cursor?: InspiracaoCursor
): Promise<InspiracaoPage> {
  const supabase = await createClient()

  let query = supabase
    .from('inspiration_posts')
    .select(`
      *,
      author:profiles!inspiration_posts_author_id_fkey(full_name, avatar_url),
      featured_student:profiles!inspiration_posts_featured_student_id_fkey(id, full_name, avatar_url, bio),
      inspiration_likes(user_id),
      inspiration_bookmarks(user_id)
    `)
    .eq('published', true)
    .eq('archived', false)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1)

  // Filtro por tipo
  if (filtros.tipo) {
    query = query.eq('type', filtros.tipo)
  }

  // Filtro por nicho/tag
  if (filtros.nicho) {
    query = query.contains('tags', [filtros.nicho])
  }

  // Filtro por curso relacionado
  if (filtros.curso_id) {
    query = query.eq('course_id', filtros.curso_id)
  }

  // Busca por palavra-chave (pg_trgm no banco, filtra localmente para flexibilidade)
  if (filtros.busca) {
    const q = filtros.busca.toLowerCase()
    // Usar ilike no banco para performance
    query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`)
  }

  // Paginação por cursor
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    )
  }

  const { data, error } = await query
  if (error) throw error

  const rows = data ?? []
  const has_more = rows.length > PAGE_SIZE
  const posts = rows.slice(0, PAGE_SIZE)

  // Contagem de likes e comments por post (service client ignora RLS)
  const postIds = posts.map(p => p.id)

  const [likeCounts, commentCounts] = await Promise.all([
    postIds.length > 0
      ? supabase
          .from('inspiration_likes')
          .select('post_id')
          .in('post_id', postIds)
      : Promise.resolve({ data: [] }),
    postIds.length > 0
      ? supabase
          .from('inspiration_comments')
          .select('post_id')
          .in('post_id', postIds)
          .eq('approved', true)
      : Promise.resolve({ data: [] }),
  ])

  const likeMap: Record<string, number> = {}
  const commentMap: Record<string, number> = {}
  for (const l of likeCounts.data ?? []) {
    likeMap[l.post_id] = (likeMap[l.post_id] ?? 0) + 1
  }
  for (const c of commentCounts.data ?? []) {
    commentMap[c.post_id] = (commentMap[c.post_id] ?? 0) + 1
  }

  const result: InspiracaoPost[] = posts.map((p: any) => ({
    ...p,
    author: p.author ?? null,
    featured_student: p.featured_student ?? null,
    like_count: likeMap[p.id] ?? 0,
    comment_count: commentMap[p.id] ?? 0,
    is_liked: (p.inspiration_likes ?? []).some((l: any) => l.user_id === userId),
    is_bookmarked: (p.inspiration_bookmarks ?? []).some((b: any) => b.user_id === userId),
  }))

  const last = result[result.length - 1]
  const next_cursor: InspiracaoCursor | null = has_more && last
    ? { created_at: last.created_at, id: last.id }
    : null

  return { posts: result, next_cursor, has_more }
}

export async function getInspiracaoById(postId: string, userId: string): Promise<InspiracaoPost | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inspiration_posts')
    .select(`
      *,
      author:profiles!inspiration_posts_author_id_fkey(full_name, avatar_url),
      featured_student:profiles!inspiration_posts_featured_student_id_fkey(id, full_name, avatar_url, bio),
      inspiration_likes(user_id),
      inspiration_bookmarks(user_id)
    `)
    .eq('id', postId)
    .eq('published', true)
    .eq('archived', false)
    .single()

  if (error || !data) return null

  const [likeCounts, commentCounts] = await Promise.all([
    supabase.from('inspiration_likes').select('post_id').eq('post_id', postId),
    supabase.from('inspiration_comments').select('post_id').eq('post_id', postId).eq('approved', true),
  ])

  return {
    ...data,
    author: (data as any).author ?? null,
    featured_student: (data as any).featured_student ?? null,
    like_count: likeCounts.data?.length ?? 0,
    comment_count: commentCounts.data?.length ?? 0,
    is_liked: ((data as any).inspiration_likes ?? []).some((l: any) => l.user_id === userId),
    is_bookmarked: ((data as any).inspiration_bookmarks ?? []).some((b: any) => b.user_id === userId),
  }
}

// ── Bookmarks (alunas) ────────────────────────────────────────────────────────

export async function getBookmarks(userId: string): Promise<InspiracaoPost[]> {
  const supabase = await createClient()

  const { data: bms, error } = await supabase
    .from('inspiration_bookmarks')
    .select('post_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error || !bms?.length) return []

  const postIds = bms.map(b => b.post_id)

  const { data: posts } = await supabase
    .from('inspiration_posts')
    .select('*, author:profiles!inspiration_posts_author_id_fkey(full_name, avatar_url)')
    .in('id', postIds)
    .eq('published', true)
    .eq('archived', false)

  if (!posts) return []

  const [likeCounts, commentCounts] = await Promise.all([
    supabase.from('inspiration_likes').select('post_id').in('post_id', postIds),
    supabase.from('inspiration_comments').select('post_id').in('post_id', postIds).eq('approved', true),
  ])

  const likeMap: Record<string, number> = {}
  const commentMap: Record<string, number> = {}
  for (const l of likeCounts.data ?? []) likeMap[l.post_id] = (likeMap[l.post_id] ?? 0) + 1
  for (const c of commentCounts.data ?? []) commentMap[c.post_id] = (commentMap[c.post_id] ?? 0) + 1

  return posts.map((p: any) => ({
    ...p,
    author: p.author ?? null,
    featured_student: null,
    like_count: likeMap[p.id] ?? 0,
    comment_count: commentMap[p.id] ?? 0,
    is_liked: false,
    is_bookmarked: true,
  }))
}

// ── Likes ─────────────────────────────────────────────────────────────────────

export async function toggleLike(userId: string, postId: string, isLiked: boolean): Promise<void> {
  const supabase = await createClient()

  if (isLiked) {
    await supabase.from('inspiration_likes').delete()
      .eq('user_id', userId).eq('post_id', postId)
  } else {
    await supabase.from('inspiration_likes').insert({ user_id: userId, post_id: postId })
  }

  revalidatePath('/inspiracoes')
}

// ── Bookmarks ─────────────────────────────────────────────────────────────────

export async function toggleBookmark(userId: string, postId: string, isBookmarked: boolean): Promise<void> {
  const supabase = await createClient()

  if (isBookmarked) {
    await supabase.from('inspiration_bookmarks').delete()
      .eq('user_id', userId).eq('post_id', postId)
  } else {
    await supabase.from('inspiration_bookmarks').insert({ user_id: userId, post_id: postId })
  }

  revalidatePath('/inspiracoes')
  revalidatePath('/inspiracoes/salvos')
}

// ── Comentários (alunas) ──────────────────────────────────────────────────────

export async function getComments(postId: string): Promise<InspiracaoComment[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inspiration_comments')
    .select('*, profiles(full_name, avatar_url)')
    .eq('post_id', postId)
    .eq('approved', true)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as InspiracaoComment[]
}

export async function submitComment(
  userId: string,
  postId: string,
  body: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const trimmed = body.trim()
  if (trimmed.length < 2) return { error: 'Comentário muito curto.' }
  if (trimmed.length > 2000) return { error: 'Comentário muito longo.' }

  const { error } = await supabase.from('inspiration_comments').insert({
    post_id: postId,
    user_id: userId,
    body: trimmed,
    approved: false,
  })

  if (error) return { error: error.message }
  return {}
}

// ── Admin — CRUD de posts ─────────────────────────────────────────────────────

export async function adminListPosts(opts: {
  published?: boolean
  archived?: boolean
  tipo?: string
  busca?: string
} = {}) {
  const supabase = createServiceClient()

  let query = supabase
    .from('inspiration_posts')
    .select('id, type, title, tags, published, archived, pinned, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (opts.published !== undefined) query = query.eq('published', opts.published)
  if (opts.archived !== undefined) query = query.eq('archived', opts.archived)
  if (opts.tipo) query = query.eq('type', opts.tipo)
  if (opts.busca) query = query.or(`title.ilike.%${opts.busca}%`)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function adminGetPost(id: string) {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('inspiration_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function adminUpsertPost(
  adminId: string,
  payload: UpsertInspiracaoPayload
): Promise<{ id: string }> {
  const supabase = createServiceClient()
  const { id, ...fields } = payload

  const record = {
    ...fields,
    author_id: adminId,
    media: fields.media ?? [],
    blocks: fields.blocks ?? [],
    tags: fields.tags ?? [],
  }

  const { data, error } = id
    ? await supabase.from('inspiration_posts').update(record).eq('id', id).select('id').single()
    : await supabase.from('inspiration_posts').insert(record).select('id').single()

  if (error) throw error

  revalidatePath('/inspiracoes')
  revalidatePath('/admin/inspiracoes')
  return { id: data.id }
}

export async function adminDeletePost(id: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('inspiration_posts').delete().eq('id', id)
  revalidatePath('/inspiracoes')
  revalidatePath('/admin/inspiracoes')
}

export async function adminArchivePost(id: string, archived: boolean): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('inspiration_posts').update({ archived }).eq('id', id)
  revalidatePath('/inspiracoes')
  revalidatePath('/admin/inspiracoes')
}

export async function adminPublishPost(id: string, published: boolean): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('inspiration_posts').update({ published }).eq('id', id)
  revalidatePath('/inspiracoes')
  revalidatePath('/admin/inspiracoes')
}

// ── Admin — Moderação de comentários ─────────────────────────────────────────

export async function adminGetPendingComments() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('inspiration_comments')
    .select(`
      *,
      profiles(full_name, avatar_url),
      inspiration_posts(title)
    `)
    .eq('approved', false)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function adminGetPendingCommentsCount(): Promise<number> {
  const supabase = createServiceClient()

  const { count, error } = await supabase
    .from('inspiration_comments')
    .select('*', { count: 'exact', head: true })
    .eq('approved', false)

  if (error) return 0
  return count ?? 0
}

export async function adminApproveComment(id: string, approved: boolean): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('inspiration_comments').update({ approved }).eq('id', id)
  revalidatePath('/inspiracoes')
  revalidatePath('/admin/inspiracoes/comentarios')
}

export async function adminDeleteComment(id: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('inspiration_comments').delete().eq('id', id)
  revalidatePath('/inspiracoes')
  revalidatePath('/admin/inspiracoes/comentarios')
}
