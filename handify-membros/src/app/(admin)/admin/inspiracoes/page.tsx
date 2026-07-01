import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Sparkles, Plus, Edit, Archive, Eye, EyeOff } from 'lucide-react'

export const metadata = { title: 'Admin — Inspirações | Handify' }

const TYPE_LABELS: Record<string, { label: string; cls: string }> = {
  foto:      { label: 'Foto',      cls: 'bg-blue-50 text-blue-700' },
  carrossel: { label: 'Carrossel', cls: 'bg-purple-50 text-purple-700' },
  video:     { label: 'Vídeo',     cls: 'bg-red-50 text-red-700' },
  receita:   { label: 'Receita',   cls: 'bg-orange-50 text-orange-700' },
  dica:      { label: 'Dica',      cls: 'bg-amber-50 text-amber-700' },
  destaque:  { label: 'Destaque',  cls: 'bg-green-50 text-green-700' },
}

export default async function AdminInspiracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const service = createServiceClient()
  const { data: posts } = await service
    .from('inspiration_posts')
    .select('id, type, title, tags, published, archived, pinned, media, created_at')
    .order('created_at', { ascending: false })

  const { count: pendingCount } = await service
    .from('inspiration_comments')
    .select('*', { count: 'exact', head: true })
    .eq('approved', false)

  const all       = posts ?? []
  const published = all.filter(p => p.published && !p.archived)
  const drafts    = all.filter(p => !p.published && !p.archived)
  const archived  = all.filter(p => p.archived)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#6699F3]/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#6699F3]" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Inspirações</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{all.length} posts · {published.length} publicados</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(pendingCount ?? 0) > 0 && (
            <Link
              href="/admin/inspiracoes/comentarios"
              className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#6699F3] border border-[#6699F3]/40 rounded-lg hover:bg-[#6699F3]/8 transition-colors"
            >
              Comentários
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#6699F3] text-white text-[10px] font-bold">
                {pendingCount}
              </span>
            </Link>
          )}
          <Link
            href="/admin/inspiracoes/novo"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#6699F3] text-white rounded-lg hover:bg-[#5588e8] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo post
          </Link>
        </div>
      </div>

      {all.length === 0 && (
        <div className="bg-white rounded-xl border border-border/60 p-12 text-center">
          <Sparkles className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum post ainda.</p>
          <Link href="/admin/inspiracoes/novo"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#6699F3] text-white rounded-lg hover:bg-[#5588e8] transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Criar primeiro post
          </Link>
        </div>
      )}

      {/* Publicados */}
      {published.length > 0 && (
        <PostSection title="Publicados" posts={published} />
      )}

      {/* Rascunhos */}
      {drafts.length > 0 && (
        <PostSection title="Rascunhos" posts={drafts} muted />
      )}

      {/* Arquivados */}
      {archived.length > 0 && (
        <PostSection title="Arquivados" posts={archived} muted />
      )}
    </div>
  )
}

function PostSection({
  title,
  posts,
  muted = false,
}: {
  title: string
  posts: any[]
  muted?: boolean
}) {
  return (
    <section>
      <h2 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${muted ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
        {title} ({posts.length})
      </h2>
      <div className="bg-white rounded-xl border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border/60">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Post</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Tipo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Tags</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Data</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {posts.map(p => {
              const typeMeta = TYPE_LABELS[p.type] ?? { label: p.type, cls: 'bg-gray-50 text-gray-700' }
              const thumb = p.media?.[0]?.url
              return (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover border border-border/40 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate max-w-[180px] sm:max-w-xs">{p.title}</p>
                        {p.pinned && (
                          <span className="text-[10px] text-[#6699F3] font-medium">📌 Fixado</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeMeta.cls}`}>
                      {typeMeta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(p.tags ?? []).slice(0, 2).map((t: string) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                      ))}
                      {(p.tags ?? []).length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{p.tags.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/inspiracoes/${p.id}`}
                      className="inline-flex items-center gap-1 text-xs text-[#6699F3] hover:underline"
                    >
                      <Edit className="w-3 h-3" />
                      Editar
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
