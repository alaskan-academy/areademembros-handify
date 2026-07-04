// ── Tipos base ────────────────────────────────────────────────────────────────

export type InspiracaoType = 'foto' | 'carrossel' | 'video' | 'receita' | 'dica' | 'destaque'

export type InspiracaoNicho = string

export interface MediaItem {
  url: string
  alt?: string
  order: number
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

// ── Comentário ────────────────────────────────────────────────────────────────

export interface InspiracaoComment {
  id: string
  post_id: string
  user_id: string
  body: string
  approved: boolean
  created_at: string
  profiles?: {
    full_name: string | null
    avatar_url: string | null
  } | null
}

// ── Filtros do feed ───────────────────────────────────────────────────────────

export interface InspiracaoFiltros {
  tipo?: InspiracaoType | ''
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
  featured_student_id?: string | null
  published?: boolean
  archived?: boolean
  pinned?: boolean
}
