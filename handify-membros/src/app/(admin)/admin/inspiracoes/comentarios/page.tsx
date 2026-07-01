import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  adminGetPendingComments,
  adminApproveComment,
  adminDeleteComment,
} from '@/lib/inspiracoes/actions'
import { ArrowLeft, Check, Trash2 } from 'lucide-react'

export const metadata = { title: 'Admin — Comentários de Inspirações | Handify' }

export default async function AdminInspComentariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const pending = await adminGetPendingComments()

  const service = createServiceClient()
  const { data: approved } = await service
    .from('inspiration_comments')
    .select('*, profiles(full_name, avatar_url), inspiration_posts(title)')
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(30)

  async function approve(id: string) {
    'use server'
    await adminApproveComment(id, true)
  }
  async function reject(id: string) {
    'use server'
    await adminDeleteComment(id)
  }

  function CommentRow({ c, showApprove }: { c: any; showApprove: boolean }) {
    const postTitle = c.inspiration_posts?.title ?? '—'
    return (
      <div className="bg-white rounded-lg border border-border/60 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-medium">{c.profiles?.full_name ?? 'Aluna'}</span>
              <span className="text-[10px] text-muted-foreground">→</span>
              <span className="text-xs text-[#6699F3] truncate max-w-[160px]">{postTitle}</span>
              <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                {new Date(c.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed">{c.body}</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {showApprove && (
              <form action={approve.bind(null, c.id)}>
                <button title="Aprovar" className="p-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
            <form action={reject.bind(null, c.id)}>
              <button title="Excluir" className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/inspiracoes" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Comentários de Inspirações</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Aprove ou exclua comentários das alunas</p>
        </div>
      </div>

      {/* Pendentes */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          Aguardando aprovação
          {pending.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#6699F3] text-white text-[10px] font-bold">
              {pending.length}
            </span>
          )}
        </h2>
        {pending.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum comentário pendente. Ótimo!</p>
        ) : (
          <div className="space-y-2">
            {pending.map((c: any) => <CommentRow key={c.id} c={c} showApprove={true} />)}
          </div>
        )}
      </section>

      {/* Aprovados */}
      <section>
        <h2 className="text-sm font-semibold mb-3">
          Aprovados ({approved?.length ?? 0})
        </h2>
        {!approved?.length ? (
          <p className="text-xs text-muted-foreground">Nenhum comentário aprovado ainda.</p>
        ) : (
          <div className="space-y-2">
            {approved.map((c: any) => <CommentRow key={c.id} c={c} showApprove={false} />)}
          </div>
        )}
      </section>
    </div>
  )
}
