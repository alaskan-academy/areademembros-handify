// ── Tag constants ─────────────────────────────────────────────────────────────

export const CATEGORY_TAGS = {
  essencias:  'Essências',
  ceras:      'Ceras / Bases',
  pavios:     'Pavios',
  moldes:     'Moldes',
  corantes:   'Corantes',
  embalagens: 'Embalagens',
  vidros:     'Potes de Vidro',
  etiquetas:  'Etiquetas',
  impressao:  'Gráfica / Impressão',
  quimicos:   'Aditivos / Químicos',
  insumos:    'Insumos Gerais',
} as const

export const CHANNEL_LABELS = {
  website:       'Site Oficial',
  instagram:     'Instagram',
  shopee:        'Shopee',
  mercadolivre:  'Mercado Livre',
} as const

export type CategoryTag = keyof typeof CATEGORY_TAGS
export type Channel     = keyof typeof CHANNEL_LABELS
export type SupplierTag = string

// ── DB row types ──────────────────────────────────────────────────────────────

export type SupplierRow = {
  id:          string
  name:        string
  description: string | null
  logo_url:    string | null
  verified:    boolean
  active:      boolean
  position:    number
  created_at:  string
  updated_at:  string
}

export type SupplierChannelRow = {
  id:          string
  supplier_id: string
  channel:     Channel
  url:         string
}

export type SupplierTagRow = {
  supplier_id: string
  tag:         string
}

export type SupplierReviewRow = {
  id:          string
  supplier_id: string
  user_id:     string
  body:        string
  approved:    boolean
  created_at:  string
}

export type SupplierSuggestionRow = {
  id:             string
  user_id:        string
  name:           string
  url:            string | null
  what_they_sell: string | null
  notes:          string | null
  status:         'pending' | 'approved' | 'rejected'
  admin_notes:    string | null
  created_at:     string
}

// ── Composed types for UI ─────────────────────────────────────────────────────

export type SupplierWithDetails = SupplierRow & {
  channels:       SupplierChannelRow[]
  tags:           string[]
  isFavorite:     boolean
  reviewCount:    number
}

export type SupplierReviewWithProfile = SupplierReviewRow & {
  profiles: { full_name: string | null; avatar_url: string | null } | null
}

// ── Filter state ──────────────────────────────────────────────────────────────

export type FornecedorFiltros = {
  produto:   string
  categoria: CategoryTag | ''
  canal:     Channel | ''
  busca:     string
}

// ── Nichos ────────────────────────────────────────────────────────────────────

export type NicheRow = {
  id:         string
  name:       string
  slug:       string
  active:     boolean
  position:   number
  created_at: string
}

// ── Produtos ──────────────────────────────────────────────────────────────────

export type ProductRow = {
  id:         string
  name:       string
  image_url:  string | null
  active:     boolean
  position:   number
  created_at: string
}

export type ProductSupplierLinkRow = {
  id:          string
  product_id:  string
  supplier_id: string
  buy_url:     string
  position:    number
}

export type ProductSupplierLinkWithSupplier = ProductSupplierLinkRow & {
  supplier: Pick<SupplierRow, 'id' | 'name' | 'logo_url' | 'verified'> & {
    tags:     string[]
    channels: { channel: string; url: string }[]
  }
}

export type ProductCourseLink = {
  product_id: string
  course_id:  string
}

export type ProductWithDetails = ProductRow & {
  suppliers:  ProductSupplierLinkWithSupplier[]
  course_ids: string[]
}
