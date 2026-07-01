import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { adminGetReviews, adminApproveReview, adminDeleteReview } from '@/lib/fornecedores/actions'
import { ArrowLeft, Check, Trash2 } from 'lucide-react'

export const metadata = { title: 'Admin — Comentários de Fornecedores | Handify' }

export default async function AdminComentariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const pending = await adminGetReviews(false)
  const approved = await adminGetReviews(true)

  async function approve(id: string) {
    'use server'
    await adminApproveReview(id, true)
  }
  async function deleteReview(id: string) {
    'use server'
    await adminDeleteReview(id)
  }

  function ReviewRow({ r, showApprove }: { r: any; showApprove: boolean }) {
    return (
      <div className="bg-white rounded-lg border border-border/60 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-medium">{r.profiles?.full_name ?? 'Aluna'}</span>
              <span className="text-[10px] text-muted-foreground">→</span>
              <span className="text-xs text-[#6699F3]">{r.suppliers?.name}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {new Date(r.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <p className="text-xs text-foreground/80">{r.body}</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {showApprove && (
              <form action={approve.bind(null, r.id)}>
                <button title="Aprovar" className="p-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
            <form action={deleteReview.bind(null, r.id)}>
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
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/fornecedores" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold">Comentários de fornecedores</h1>
      </div>

      {/* Pending */}
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
          <p className="text-xs text-muted-foreground">Nenhum comentário pendente.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((r: any) => <ReviewRow key={r.id} r={r} showApprove={true} />)}
          </div>
        )}
      </section>

      {/* Approved */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Aprovados ({approved.length})</h2>
        {approved.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum comentário aprovado.</p>
        ) : (
          <div className="space-y-2">
            {approved.map((r: any) => <ReviewRow key={r.id} r={r} showApprove={false} />)}
          </div>
        )}
      </section>
    </div>
  )
}
