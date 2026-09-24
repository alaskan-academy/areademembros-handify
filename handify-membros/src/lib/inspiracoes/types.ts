// ── Tipos base ────────────────────────────────────────────────────────────────

export type InspiracaoType = 'foto' | 'carrossel' | 'video' | 'receita' | 'dica' | 'destaque'

export type InspiracaoNicho = string

export interface MediaItem {
  url: string
  alt?: string
  order: number
  /** 'video' faz o carrossel embutir o player em vez de mostrar imagem. */
  tipo?: 'imagem' | 'video'
  /** Proporção do vídeo, ex. "9/16". Padrão 9/16, que é o formato dos tutoriais. */
  aspect?: string
}

export interface ContentBlock {
  type: 'text' | 'html' | 'embed' | 'download' | 'video_meta'
  content: string
  position: number
}

export interface Ingrediente {
  item: string
  quantidade: string
}

export interface ReceitaData {
  /** Para que serve o produto. Aparece logo abaixo da foto, antes da ficha. */
  beneficios?: string[]
  ingredientes?: Ingrediente[]
  passos?: string[]
  como_fazer?: string[]     // passo a passo curto (inspirações com receita simplificada)
  tempo?: string | null
  temperatura?: string | null
  nivel?: string | null
  dicas?: string | null
  paleta_cores?: string[]
  custo_medio?: string | null
  preco_venda?: string | null
}

// ── Row do banco ──────────────────────────────────────────────────────────────

export interface InspiracaoPostRow {
  id: string
  author_id: string
  type: InspiracaoType
  title: string
  body: string | null
  media: MediaItem[]
  video_url: string | null
  blocks: ContentBlock[]
  recipe_data: ReceitaData | null
  tags: string[]
  course_id: string | null
  course_ids: string[]
  featured_student_id: string | null
  published: boolean
  archived: boolean
  pinned: boolean
  created_at: string
  updated_at: string
}

// ── Post com dados extras para o feed ─────────────────────────────────────────

export interface InspiracaoPost extends InspiracaoPostRow {
  like_count: number
  comment_count: number
  is_liked: boolean       // pelo usuário atual
  is_bookmarked: boolean  // pelo usuário atual
  /**
   * `blocks` veio cortado: existe mais texto guardado no servidor.
   *
   * O feed manda só o pedaço que aparece antes do "Ver mais" — medido, eram
   * 42.888 bytes de `blocks` nos 13 posts da primeira página, e esse objeto
   * desce duas vezes no HTML (DOM + payload de hidratação). O resto vem de
   * `getConteudoCompleto(postId)` quando a aluna toca no botão.
   *
   * A tela precisa deste aviso em vez de olhar a altura renderizada: um post
   * cuja prévia não estoura os 320px do corte não mostraria botão nenhum, e o
   * texto guardado ficaria inalcançável.
   *
   * false no link profundo e em /salvos, que já recebem o post inteiro.
   */
  conteudo_truncado: boolean
  author?: {
    full_name: string | null
    avatar_url: string | null
  }
  featured_student?: {
    id: string
    full_name: string | null
    avatar_url: string | null
    bio: string | null
  } | null
}

/**
 * O que `getConteudoCompleto(postId)` devolve: o conteúdo pesado de UM post,
 * buscado sob demanda quando a aluna abre o "Ver mais".
 */
export interface ConteudoCompleto {
  blocks: ContentBlock[]
  recipe_data: ReceitaData | null
}

// ── Comentário ────────────────────────────────────────────────────────────────

export interface InspiracaoComment {
  id: string
  post_id: string
  user_id: string
  parent_id?: string | null
  body: string
  approved: boolean
  created_at: string
  profiles?: {
    full_name: string | null
    avatar_url: string | null
  } | null
  replies?: InspiracaoComment[]
}

// ── Filtros do feed ───────────────────────────────────────────────────────────

/** Curso na barra de filtros de Inspirações. */
export interface CursoDoFiltro {
  id: string
  title: string
  slug: string
  price: number | null
  checkoutUrl: string | null
  /** false = aparece em cinza, com cadeado, e abre o convite de compra. */
  temAcesso: boolean
}

export interface InspiracaoFiltros {
  tipo?: InspiracaoType | ''
  /** Tag do post — usada por destaques, não pela tela de filtros. */
  nicho?: string
  curso_id?: string
  busca?: string
}

// ── Paginação por cursor ──────────────────────────────────────────────────────

export interface InspiracaoCursor {
  created_at: string
  id: string
}

export interface InspiracaoPage {
  posts: InspiracaoPost[]
  next_cursor: InspiracaoCursor | null
  has_more: boolean
}

// ── Payload para criar/editar post (admin) ────────────────────────────────────

export interface UpsertInspiracaoPayload {
  id?: string
  type: InspiracaoType
  title: string
  body?: string
  media?: MediaItem[]
  video_url?: string
  blocks?: ContentBlock[]
  recipe_data?: ReceitaData
  tags?: string[]
  course_id?: string | null
  course_ids?: string[]
  featured_student_id?: string | null
  published?: boolean
  archived?: boolean
  pinned?: boolean
}
