import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { adminListComments, adminApproveComment, adminDeleteComment } from '@/lib/inspiracoes/actions'
import ComentarioFilaCard from '@/components/admin/inspiracoes/ComentarioFilaCard'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Admin — Comentários de Inspirações | Handify' }

/** Quantos comentários já publicados a tela mostra abaixo da fila. */
const APROVADOS_NA_TELA = 30

export default async function AdminInspComentariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // As duas listas saem da mesma action: ela é quem confere o role de novo (o
  // redirect acima só vale no render, não no POST) e quem monta o contexto —
  // título do post, comentário respondido e link profundo.
  const [pendentes, publicados] = await Promise.all([
    adminListComments({ aprovados: false }),
    adminListComments({ aprovados: true, limite: APROVADOS_NA_TELA }),
  ])

  async function aprovar(id: string) {
    'use server'
    await adminApproveComment(id, true)
  }
  async function excluir(id: string) {
    'use server'
    await adminDeleteComment(id)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/inspiracoes"
          aria-label="Voltar para Inspirações"
          className="p-2 rounded-lg hover:bg-muted handify-transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Comentários de Inspirações</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Clique no comentário para abrir o post e ver onde ela escreveu — a resposta é lá mesmo, depois de aprovar.
          </p>
        </div>
      </div>

      {/* Fila */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          Aguardando aprovação
          {pendentes.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[#6699F3] text-white text-xs font-bold">
              {pendentes.length}
            </span>
          )}
        </h2>
        {pendentes.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum comentário pendente. Ótimo!</p>
        ) : (
          <div className="space-y-2">
            {pendentes.map((c) => (
              <ComentarioFilaCard
                key={c.id}
                comentario={c}
                aprovar={aprovar.bind(null, c.id)}
                excluir={excluir.bind(null, c.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Já publicados */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Publicados ({publicados.length})</h2>
        {publicados.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum comentário aprovado ainda.</p>
        ) : (
          <div className="space-y-2">
            {publicados.map((c) => (
              <ComentarioFilaCard key={c.id} comentario={c} excluir={excluir.bind(null, c.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
