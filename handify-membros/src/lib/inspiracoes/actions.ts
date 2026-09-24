'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hasActiveMembership } from '@/lib/auth/access'
import { filtroOrIlike } from '@/lib/db/like'
// Uma regra, um lugar. Duas frentes escreveram este mesmo link em arquivos
// diferentes; a versão que fica é a de `deep-link.ts`, que também é quem LÊ os
// parâmetros do outro lado — gerar e ler pelo mesmo módulo é o que impede os
// dois de divergirem sem ninguém notar. O arquivo é puro (sem 'use client'),
// então importar daqui, de um módulo 'use server', é seguro.
import { montarDeepLink } from '@/components/inspiracoes/deep-link'
import { revalidatePath } from 'next/cache'
import type {
  InspiracaoPost,
  InspiracaoComment,
  InspiracaoFiltros,
  InspiracaoCursor,
  InspiracaoPage,
  UpsertInspiracaoPayload,
  CursoDoFiltro,
  ContentBlock,
  ConteudoCompleto,
} from './types'

/**
 * Quantos posts o servidor monta por vez.
 *
 * Eram 12 (13 com o post-sonda da próxima página). Medido em 24/09: os 12 posts
 * chegavam ao componente como um objeto de 83.638 bytes — e esse objeto desce
 * DUAS vezes no HTML, porque o InspiracaoFeed é 'use client' e recebe os posts
 * por prop (uma vez no DOM já renderizado, outra no payload que hidrata a tela).
 * Era o grosso dos 261 KB da página.
 *
 * Só com as colunas explícitas e a prévia recortada, os mesmos 12 posts caem
 * para 45.916 bytes; com 6, para 28.874. O acervo tem 20 posts publicados, e o
 * "Carregar mais" é botão, não rolagem automática: ela toca três vezes em vez
 * de uma para chegar ao fim — só que cada toque agora custa uma ida ao banco de
 * ~58 ms, não três de ~172 ms. Nenhum post some da lista, e a ordem é a mesma.
 */
const PAGE_SIZE = 6

/**
 * Colunas que a lista realmente usa. Antes era `select("*")`.
 *
 * `blocks` continua aqui porque o corte da prévia é feito no servidor (ver
 * `aliviarBlocos`) — o que não desce é o texto que ficava escondido atrás do
 * "Ver mais". `recipe_data` também fica: medido, são 6.710 bytes nos 13 posts,
 * e é justamente o que aparece ANTES do corte num post de receita (benefícios,
 * ficha, ingredientes). Tirá-lo deixaria o card de receita em branco.
 *
 * `published` e `archived` vêm por fidelidade ao tipo da linha (a consulta já
 * filtra os dois); custam 30 bytes por post.
 */
const COLUNAS_DO_FEED = `
  id, author_id, type, title, body, media, video_url, blocks, recipe_data,
  tags, course_id, course_ids, featured_student_id, published, archived,
  pinned, created_at, updated_at
`

/**
 * Quanto de texto de bloco desce no feed, em caracteres.
 *
 * O corte do "Ver mais" é por altura de CSS (320px no InspiracaoFeedItem), que
 * num celular de 375px cabe em torno de 700 caracteres de texto corrido. 1.800
 * dá folga para o HTML da dica (tags, classes) e ainda assim corta cedo: os
 * blocos reais do acervo têm de 2.243 a 6.682 caracteres, sete deles acima de
 * 3.000. Medido: 42.888 bytes de `blocks` nos 13 posts do feed.
 */
const PREVIA_DO_BLOCO = 1800

/** Fechamentos onde é seguro cortar sem partir um parágrafo no meio da frase. */
const FECHAMENTOS = [
  '</p>', '</li>', '</ul>', '</ol>', '</h2>', '</h3>', '</h4>',
  '</blockquote>', '</section>', '</div>', '</tr>', '</table>', '</details>',
]

/**
 * Recorta HTML sem nunca partir uma tag ao meio.
 *
 * Procura o último fechamento de bloco dentro do orçamento; se não achar nenhum
 * (ou achar cedo demais, o que deixaria um pedaço ridículo), volta para o
 * último `>`, que é sempre um limite seguro. Tag de abertura que ficar sem par
 * é fechada pelo próprio parser do navegador e pelo DOMPurify do cliente.
 */
function recortarHtml(html: string, orcamento: number): { conteudo: string; cortado: boolean } {
  if (html.length <= orcamento) return { conteudo: html, cortado: false }

  const janela = html.slice(0, orcamento)
  let corte = -1
  for (const tag of FECHAMENTOS) {
    const i = janela.lastIndexOf(tag)
    if (i >= 0) corte = Math.max(corte, i + tag.length)
  }

  if (corte < orcamento / 3) {
    const ultimaTag = janela.lastIndexOf('>')
    corte = ultimaTag >= 0 ? ultimaTag + 1 : orcamento
  }

  return { conteudo: html.slice(0, corte), cortado: true }
}

/**
 * Deixa no post só o pedaço de conteúdo que a lista mostra antes do "Ver mais".
 *
 * O resto vem por `getConteudoCompleto` quando ela toca no botão. `cortado`
 * avisa a tela que existe mais texto guardado — sem isso ela teria de adivinhar
 * pela altura renderizada, e um post inteiramente truncado que não estoura os
 * 320px nunca mostraria o botão.
 *
 * `video_meta` passa sempre: não é texto, é a proporção do vídeo (4 bytes), e o
 * player fica ACIMA do corte — sem ele o vídeo 9/16 do tutorial abriria em 16/9.
 */
function aliviarBlocos(blocks: unknown): { blocks: ContentBlock[]; conteudo_truncado: boolean } {
  const todos = Array.isArray(blocks) ? (blocks as ContentBlock[]) : []
  const saida: ContentBlock[] = []
  let conteudo_truncado = false
  let orcamento = PREVIA_DO_BLOCO

  for (const bloco of todos) {
    if (bloco?.type === 'video_meta') {
      saida.push(bloco)
      continue
    }
    if (orcamento <= 0) {
      conteudo_truncado = true
      continue
    }

    const conteudo = typeof bloco?.content === 'string' ? bloco.content : ''
    if (conteudo.length <= orcamento) {
      saida.push(bloco)
      orcamento -= conteudo.length
      continue
    }

    const recorte = recortarHtml(conteudo, orcamento)
    saida.push({ ...bloco, content: recorte.conteudo })
    conteudo_truncado = conteudo_truncado || recorte.cortado
    orcamento = 0
  }

  return { blocks: saida, conteudo_truncado }
}

/** Primeira (e única) linha do `count` agregado do PostgREST: `[{ count: n }]`. */
function contagem(embed: unknown): number {
  if (Array.isArray(embed)) return Number(embed[0]?.count ?? 0)
  if (embed && typeof embed === 'object') return Number((embed as { count?: number }).count ?? 0)
  return 0
}

/**
 * Prova que quem chamou é admin, antes de qualquer ação de admin deste arquivo.
 *
 * Estava faltando nas 10 funções `admin*` daqui: todas abriam direto o service
 * client, que usa a service role e ignora RLS. E este é um módulo 'use server':
 * o InspiracaoForm é 'use client' e importa `adminUpsertPost` e
 * `adminDeletePost`, então o Next publica o ID dessas actions num chunk estático
 * que qualquer pessoa logada baixa.
 *
 * A única guarda de role que existia rodava ao RENDERIZAR a página do admin — e
 * render não acontece no POST de uma Server Action. Ou seja: uma aluna comum
 * lia o ID no chunk, postava de dentro de uma tela que ela já acessa e criava,
 * sobrescrevia, publicava ou apagava qualquer post do acervo de Inspirações.
 * RLS não segurava nada, porque o service client passa por cima dela.
 *
 * Lê o próprio perfil com o client de sessão de propósito: com service client a
 * consulta traria o role de qualquer id que viesse do cliente e a guarda não
 * valeria nada. (A regra "profiles sempre com service client" vale para ler o
 * perfil de OUTRAS alunas, não a própria linha.)
 */
async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autorizado')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') throw new Error('Não autorizado')
  return { supabase, user }
}

// ── Feed (alunas) ─────────────────────────────────────────────────────────────

/**
 * Cursos que têm ao menos um post no acervo — a tela só mostra estes.
 * Antes a lista trazia os 11 cursos publicados, e 8 deles abriam tela vazia.
 */
export async function cursosComAcervo(userId?: string): Promise<CursoDoFiltro[]> {
  const service = createServiceClient()
  const agora = new Date().toISOString()
  const [{ data: posts }, { data: cursos }, { data: minhas }, temPlano] = await Promise.all([
    service.from('inspiration_posts').select('course_ids, course_id').eq('published', true).eq('archived', false),
    service.from('courses').select('id, title, slug, price, checkout_url, in_plan').eq('published', true),
    userId
      ? service.from('enrollments').select('course_id').eq('user_id', userId).or(`expires_at.is.null,expires_at.gt.${agora}`)
      : Promise.resolve({ data: [] as { course_id: string }[] }),
    userId ? hasActiveMembership(userId) : Promise.resolve(false),
  ])

  const comPost = new Set<string>()
  for (const p of posts ?? []) {
    for (const id of ((p.course_ids as string[] | null) ?? []).concat(p.course_id ? [p.course_id as string] : [])) {
      comPost.add(id)
    }
  }
  const dela = new Set((minhas ?? []).map((e) => e.course_id as string))

  return (cursos ?? [])
    .filter((c) => comPost.has(c.id as string))
    .map((c) => ({
      id: c.id as string,
      title: c.title as string,
      slug: c.slug as string,
      price: c.price != null ? Number(c.price) : null,
      checkoutUrl: (c.checkout_url as string | null) ?? null,
      // Quem tem o Completo abre tudo que está no plano.
      temAcesso: dela.has(c.id as string) || (temPlano && !!c.in_plan),
    }))
    .sort((a, b) => {
      // Os cursos dela primeiro; depois os trancados, em ordem alfabética.
      if (a.temAcesso !== b.temAcesso) return a.temAcesso ? -1 : 1
      return a.title.localeCompare(b.title, 'pt-BR')
    })
}

export async function getInspiracoesFeed(
  userId: string,
  filtros: InspiracaoFiltros = {},
  cursor?: InspiracaoCursor
): Promise<InspiracaoPage> {
  const supabase = await createClient()

  // Uma ida só ao PostgREST. Eram três: a dos posts e mais duas que traziam
  // TODAS as linhas de curtida e de comentário desses posts só para contar o
  // tamanho do array no TypeScript. Medido em 24/09 (melhor de três): 172 ms
  // nas três idas (76 + 44 + 52) contra 58 ms nesta. Cada ida custa 35-100 ms
  // de rede; a consulta em si leva 0,5 ms no banco, então o que pesava era o
  // número de idas, não o banco.
  //
  // `total_curtidas` e `total_comentarios` são o `count` agregado do PostgREST:
  // o Postgres conta e devolve o número. `minha_curtida` e `meu_salvo` são a
  // MESMA tabela embutida de novo, agora filtrada pelo id dela — antes os
  // embeds vinham sem filtro e desciam as 249 linhas de curtida e salvo dos 13
  // posts, que o `...p` ainda copiava para dentro do objeto entregue à tela.
  let query = supabase
    .from('inspiration_posts')
    .select(`
      ${COLUNAS_DO_FEED},
      author:profiles!inspiration_posts_author_id_fkey(full_name, avatar_url),
      featured_student:profiles!inspiration_posts_featured_student_id_fkey(id, full_name, avatar_url, bio),
      minha_curtida:inspiration_likes(user_id),
      meu_salvo:inspiration_bookmarks(user_id),
      total_curtidas:inspiration_likes(count),
      total_comentarios:inspiration_comments(count)
    `)
    .eq('published', true)
    .eq('archived', false)
    // Filtros DENTRO dos embeds (o nome antes do ponto é o apelido do embed):
    // não mexem em quais posts voltam, só em quais linhas filhas vêm junto.
    .eq('minha_curtida.user_id', userId)
    .eq('meu_salvo.user_id', userId)
    .eq('total_comentarios.approved', true)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1)

  // Filtro por tipo
  if (filtros.tipo) {
    query = query.eq('type', filtros.tipo)
  }

  // Filtro por tag (mantido: a busca por tag ainda serve para destaques)
  if (filtros.nicho) {
    query = query.contains('tags', [filtros.nicho])
  }

  // Filtro por curso relacionado (course_ids[] tem prioridade; fallback para course_id legado)
  if (filtros.curso_id) {
    query = query.contains('course_ids', [filtros.curso_id])
  }

  // Busca por palavra-chave (pg_trgm no banco, filtra localmente para flexibilidade)
  if (filtros.busca) {
    const q = filtros.busca.toLowerCase()
    // Usar ilike no banco para performance
    query = query.or(`${filtroOrIlike('title', q)},${filtroOrIlike('body', q)}`)
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

  const result: InspiracaoPost[] = posts.map((p: any) => {
    // Os apelidos dos embeds ficam de fora do objeto entregue: viram número e
    // booleano logo abaixo, e copiá-los junto só engordaria o HTML.
    const { minha_curtida, meu_salvo, total_curtidas, total_comentarios, ...post } = p
    const { blocks, conteudo_truncado } = aliviarBlocos(p.blocks)

    return {
      ...post,
      blocks,
      conteudo_truncado,
      author: p.author ?? null,
      featured_student: p.featured_student ?? null,
      like_count: contagem(total_curtidas),
      comment_count: contagem(total_comentarios),
      is_liked: (minha_curtida ?? []).length > 0,
      is_bookmarked: (meu_salvo ?? []).length > 0,
    }
  })

  const last = result[result.length - 1]
  const next_cursor: InspiracaoCursor | null = has_more && last
    ? { created_at: last.created_at, id: last.id }
    : null

  return { posts: result, next_cursor, has_more }
}

/**
 * O conteúdo que o feed não manda de cara: o resto dos blocos e a receita.
 *
 * É o outro lado do `aliviarBlocos`. A lista desce com a prévia e o aviso
 * `conteudo_truncado`; quando ela toca em "Ver mais", a tela pede o post
 * inteiro aqui — um post, não treze.
 *
 * O acesso é o MESMO do feed, de propósito: client de sessão (a RLS de
 * `inspiration_posts` só abre para admin, assinante do plano ou aluna com
 * matrícula viva) e os mesmos `published`/`archived` da lista. Buscar por id
 * não pode abrir o que a lista não abriria.
 */
export async function getConteudoCompleto(postId: string): Promise<ConteudoCompleto | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inspiration_posts')
    .select('blocks, recipe_data')
    .eq('id', postId)
    .eq('published', true)
    .eq('archived', false)
    .maybeSingle()

  if (error || !data) return null

  return {
    blocks: Array.isArray(data.blocks) ? (data.blocks as ContentBlock[]) : [],
    recipe_data: data.recipe_data ?? null,
  }
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
    // Aqui vai tudo: é o link profundo, que abre o post inteiro. Nada a buscar
    // depois — por isso o aviso de conteúdo cortado é false.
    conteudo_truncado: false,
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
    // /salvos é grade de card e modal: o modal mostra o post inteiro, então o
    // conteúdo desce completo e não há o que buscar depois.
    conteudo_truncado: false,
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
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('inspiration_comments')
    .select('*, profiles(full_name, avatar_url)')
    .eq('post_id', postId)
    .eq('approved', true)
    .order('created_at', { ascending: true })

  if (error) throw error

  const all = (data ?? []) as InspiracaoComment[]
  const topLevel = all.filter(c => !c.parent_id)
  const repliesMap: Record<string, InspiracaoComment[]> = {}
  for (const c of all) {
    if (c.parent_id) {
      if (!repliesMap[c.parent_id]) repliesMap[c.parent_id] = []
      repliesMap[c.parent_id].push(c)
    }
  }
  return topLevel.map(c => ({ ...c, replies: repliesMap[c.id] ?? [] }))
}

/**
 * Avisa a autora do comentário pai que alguém respondeu.
 *
 * O link vinha fixo em '/inspiracoes': a aluna clicava no sino e caía no acervo
 * inteiro, sem saber em qual post estava a resposta — e o acervo já passa de uma
 * página, então na prática ela não achava. Agora vai o link profundo do
 * contrato, que abre o post e rola até a resposta.
 *
 * Service client de propósito: a notificação é gravada na linha de OUTRA pessoa
 * (a dona do comentário pai) e a leitura do pai atravessa a RLS que só mostra
 * comentário aprovado — com o client de sessão as duas voltariam vazias.
 */
async function notificarRespostaNoComentario(opts: {
  commentId: string
  parentId: string
  postId: string
  autorId: string
  body: string
}): Promise<void> {
  const service = createServiceClient()

  const { data: pai } = await service
    .from('inspiration_comments')
    .select('user_id')
    .eq('id', opts.parentId)
    .single()

  // Ninguém recebe aviso de responder a si mesma.
  if (!pai || pai.user_id === opts.autorId) return

  const preview = opts.body.slice(0, 80)
  await service.from('notifications').insert({
    user_id: pai.user_id,
    type: 'comment_reply',
    title: 'Alguém respondeu ao seu comentário',
    body: preview.length < opts.body.length ? `${preview}...` : preview,
    link: montarDeepLink(opts.postId, opts.commentId),
    read: false,
  })
}

/**
 * Comentário da aluna entra na fila de moderação; o da admin já nasce aprovado.
 *
 * Antes gravava `approved: false` para todo mundo, inclusive admin: a Jessica
 * respondia uma dúvida dentro do acervo e a própria resposta sumia da tela até
 * ela ir em /admin/inspiracoes/comentarios e aprovar a si mesma. Os 12
 * comentários de admin que existem hoje passaram todos por essa volta.
 *
 * `userId` chega como parâmetro porque o painel de comentários é 'use client' —
 * e por isso mesmo não dá para confiar nele para decidir quem é admin. Quem
 * manda é a sessão lida aqui no servidor: o insert grava o id da sessão e o role
 * vem do perfil desse id. Se decidisse pelo parâmetro, bastava a aluna mandar o
 * id de uma admin para publicar sem passar por moderação.
 *
 * O perfil é lido com o client de sessão de propósito — é a própria linha dela.
 * (A regra "profiles sempre com service client" vale para ler o perfil de OUTRAS
 * alunas; com service client aqui a consulta aceitaria qualquer id do cliente.)
 */
export async function submitComment(
  userId: string,
  postId: string,
  body: string,
  parentId?: string
): Promise<{ error?: string; approved?: boolean }> {
  const supabase = await createClient()

  const trimmed = body.trim()
  if (trimmed.length < 2) return { error: 'Comentário muito curto.' }
  if (trimmed.length > 2000) return { error: 'Comentário muito longo.' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sua sessão expirou. Entre de novo para comentar.' }

  const { data: perfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const ehAdmin = perfil?.role === 'admin'

  const record: Record<string, unknown> = {
    post_id: postId,
    user_id: user.id,
    body: trimmed,
    approved: ehAdmin,
  }
  if (parentId) record.parent_id = parentId

  if (!ehAdmin) {
    // Sem `.select()` de propósito. Pedir a linha de volta faz o Postgres passar
    // o RETURNING pela policy de leitura, que só mostra comentário aprovado — o
    // comentário recém-criado da aluna não passa por ela e a gravação inteira
    // voltaria como erro. Aqui não precisamos do id: nada é notificado enquanto
    // o comentário está na fila.
    const { error } = await supabase.from('inspiration_comments').insert(record)
    if (error) return { error: error.message }
    return { approved: false }
  }

  const { data: criado, error } = await supabase
    .from('inspiration_comments')
    .insert(record)
    .select('id')
    .single()

  if (error) return { error: error.message }

  // A notificação de resposta saía na aprovação. Como o comentário da admin não
  // passa mais por lá, a resposta dela chegaria muda para a aluna.
  if (parentId && criado) {
    await notificarRespostaNoComentario({
      commentId: criado.id,
      parentId,
      postId,
      autorId: user.id,
      body: trimmed,
    })
  }

  // Já está visível para todo mundo: a contagem de comentários do feed muda.
  revalidatePath('/inspiracoes')
  return { approved: true }
}

// ── Admin — CRUD de posts ─────────────────────────────────────────────────────

export async function adminListPosts(opts: {
  published?: boolean
  archived?: boolean
  tipo?: string
  busca?: string
} = {}) {
  await assertAdmin()
  const supabase = createServiceClient()

  let query = supabase
    .from('inspiration_posts')
    .select('id, type, title, tags, published, archived, pinned, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (opts.published !== undefined) query = query.eq('published', opts.published)
  if (opts.archived !== undefined) query = query.eq('archived', opts.archived)
  if (opts.tipo) query = query.eq('type', opts.tipo)
  if (opts.busca) query = query.or(filtroOrIlike('title', opts.busca))

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function adminGetPost(id: string) {
  await assertAdmin()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('inspiration_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

// A autoria vinha do cliente (`adminId` no primeiro argumento) e ia direta para
// `author_id`: dava para assinar um post em nome de outra pessoa. Agora vem da
// sessão provada pelo assertAdmin.
export async function adminUpsertPost(
  payload: UpsertInspiracaoPayload
): Promise<{ id: string }> {
  const { user } = await assertAdmin()
  const supabase = createServiceClient()
  const { id, ...fields } = payload

  const record = {
    ...fields,
    author_id: user.id,
    media: fields.media ?? [],
    blocks: fields.blocks ?? [],
    tags: fields.tags ?? [],
    course_ids: fields.course_ids ?? [],
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
  await assertAdmin()
  const supabase = createServiceClient()
  await supabase.from('inspiration_posts').delete().eq('id', id)
  revalidatePath('/inspiracoes')
  revalidatePath('/admin/inspiracoes')
}

export async function adminArchivePost(id: string, archived: boolean): Promise<void> {
  await assertAdmin()
  const supabase = createServiceClient()
  await supabase.from('inspiration_posts').update({ archived }).eq('id', id)
  revalidatePath('/inspiracoes')
  revalidatePath('/admin/inspiracoes')
}

export async function adminPublishPost(id: string, published: boolean): Promise<void> {
  await assertAdmin()
  const supabase = createServiceClient()
  await supabase.from('inspiration_posts').update({ published }).eq('id', id)
  revalidatePath('/inspiracoes')
  revalidatePath('/admin/inspiracoes')
}

// ── Admin — Moderação de comentários ─────────────────────────────────────────

/** Comentário com o contexto que falta para moderar sem adivinhar. */
interface ComentarioModerado {
  id: string
  postId: string
  postTitulo: string
  autorNome: string | null
  body: string
  createdAt: string
  aprovado: boolean
  /** Nome de quem escreveu o comentário respondido, quando este é resposta. */
  paiNome: string | null
  /** Trecho do comentário respondido — o que dá sentido à resposta. */
  paiTexto: string | null
  /** Link profundo: abre o post no acervo e rola até este comentário. */
  href: string
}

/** Quanto do comentário pai cabe no card sem empurrar os botões para fora. */
const PREVIA_PAI = 160

/** Linha crua do PostgREST na consulta da fila (o service client não é tipado). */
interface LinhaDeComentario {
  id: string
  post_id: string
  parent_id: string | null
  body: string
  approved: boolean
  created_at: string
  profiles: { full_name: string | null } | null
  inspiration_posts: { title: string } | null
}

interface LinhaDePai {
  id: string
  body: string
  profiles: { full_name: string | null } | null
}

/**
 * Fila de moderação de comentários, com o contexto junto.
 *
 * Antes a tela mostrava só o texto solto do comentário: a Jessica aprovava
 * "ficou lindo, qual essência você usou?" sem saber em que post isso foi escrito
 * nem a que pergunta respondia. Agora vêm o título do post, o trecho do
 * comentário respondido e o link que abre o post com o comentário em destaque.
 *
 * Service client porque `profiles` e `inspiration_posts` aqui são de OUTRAS
 * pessoas — com o client de sessão a RLS devolve null e o nome da aluna some —
 * e porque a RLS de `inspiration_comments` só mostra o que já está aprovado, ou
 * seja, esconderia justamente a fila.
 */
export async function adminListComments(
  opts: { aprovados: boolean; limite?: number } = { aprovados: false }
): Promise<ComentarioModerado[]> {
  await assertAdmin()
  const supabase = createServiceClient()

  // Pendentes: mais antigo primeiro, que é a ordem de quem está esperando.
  // Aprovados: mais recente primeiro, que é o que ela quer conferir.
  let query = supabase
    .from('inspiration_comments')
    .select(`
      id, post_id, parent_id, body, approved, created_at,
      profiles(full_name),
      inspiration_posts(title)
    `)
    .eq('approved', opts.aprovados)
    .order('created_at', { ascending: !opts.aprovados })

  if (opts.limite) query = query.limit(opts.limite)

  const { data, error } = await query
  if (error) throw error

  // Passa por `unknown` porque o supabase-js, sem tipos gerados, adivinha que
  // todo embed é lista. Em tempo de execução `profiles` e `inspiration_posts`
  // vêm como objeto — são FKs de muitos-para-um, e é assim que a tela já lê hoje.
  const linhas = (data ?? []) as unknown as LinhaDeComentario[]

  // O comentário pai vem numa segunda consulta em vez de auto-join: o embed de
  // uma tabela nela mesma depende do nome exato da FK, que já quebrou por aqui.
  const idsDosPais = [
    ...new Set(linhas.map((c) => c.parent_id).filter((id): id is string => !!id)),
  ]
  const pais: Record<string, { nome: string | null; texto: string }> = {}
  if (idsDosPais.length > 0) {
    const { data: linhasPai } = await supabase
      .from('inspiration_comments')
      .select('id, body, profiles(full_name)')
      .in('id', idsDosPais)
    for (const p of (linhasPai ?? []) as unknown as LinhaDePai[]) {
      pais[p.id] = { nome: p.profiles?.full_name ?? null, texto: p.body }
    }
  }

  return linhas.map((c) => {
    const pai = c.parent_id ? pais[c.parent_id] : undefined
    const texto = pai?.texto ?? null
    return {
      id: c.id,
      postId: c.post_id,
      // Post apagado com comentário ainda na fila: a tela não pode quebrar por isso.
      postTitulo: c.inspiration_posts?.title ?? 'Post removido',
      autorNome: c.profiles?.full_name ?? null,
      body: c.body,
      createdAt: c.created_at,
      aprovado: Boolean(c.approved),
      paiNome: pai?.nome ?? null,
      paiTexto:
        texto && texto.length > PREVIA_PAI ? `${texto.slice(0, PREVIA_PAI)}...` : texto,
      href: montarDeepLink(c.post_id, c.id),
    }
  })
}

export async function adminGetPendingCommentsCount(): Promise<number> {
  await assertAdmin()
  const supabase = createServiceClient()

  const { count, error } = await supabase
    .from('inspiration_comments')
    .select('*', { count: 'exact', head: true })
    .eq('approved', false)

  if (error) return 0
  return count ?? 0
}

export async function adminApproveComment(id: string, approved: boolean): Promise<void> {
  await assertAdmin()
  const supabase = createServiceClient()

  const { data: comment } = await supabase
    .from('inspiration_comments')
    .select('parent_id, user_id, body, post_id')
    .eq('id', id)
    .single()

  await supabase.from('inspiration_comments').update({ approved }).eq('id', id)

  if (approved && comment?.parent_id) {
    await notificarRespostaNoComentario({
      commentId: id,
      parentId: comment.parent_id,
      postId: comment.post_id,
      autorId: comment.user_id,
      body: comment.body,
    })
  }

  revalidatePath('/inspiracoes')
  revalidatePath('/admin/inspiracoes/comentarios')
}

export async function adminDeleteComment(id: string): Promise<void> {
  await assertAdmin()
  const supabase = createServiceClient()
  await supabase.from('inspiration_comments').delete().eq('id', id)
  revalidatePath('/inspiracoes')
  revalidatePath('/admin/inspiracoes/comentarios')
}
