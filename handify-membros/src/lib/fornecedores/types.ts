// ── Tag constants ─────────────────────────────────────────────────────────────

export const PRODUCT_TAGS = {
  velas:     'Velas Artesanais',
  sabonetes: 'Sabonetes',
} as const

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

export type ProductTag  = keyof typeof PRODUCT_TAGS
export type CategoryTag = keyof typeof CATEGORY_TAGS
export type Channel     = keyof typeof CHANNEL_LABELS
export type SupplierTag = ProductTag | CategoryTag

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
  produto:  ProductTag | ''
  categoria: CategoryTag | ''
  canal:    Channel | ''
  busca:    string
}
