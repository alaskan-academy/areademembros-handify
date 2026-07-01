import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { adminGetSuggestions, adminUpdateSuggestionStatus } from '@/lib/fornecedores/actions'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export const metadata = { title: 'Admin — Sugestões de Fornecedores | Handify' }

const STATUS_LABEL = {
  pending:  { label: 'Pendente',  cls: 'bg-yellow-50 text-yellow-700' },
  approved: { label: 'Aprovada',  cls: 'bg-green-50 text-green-700' },
  rejected: { label: 'Rejeitada', cls: 'bg-red-50 text-red-600' },
}

export default async function AdminSugestoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const suggestions = await adminGetSuggestions()

  async function approve(id: string) {
    'use server'
    await adminUpdateSuggestionStatus(id, 'approved')
  }
  async function reject(id: string) {
    'use server'
    await adminUpdateSuggestionStatus(id, 'rejected')
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/fornecedores" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold">Sugestões de fornecedores</h1>
      </div>

      {suggestions.length === 0 ? (
        <div className="bg-white rounded-xl border border-border/60 p-8 text-center text-muted-foreground text-sm">
          Nenhuma sugestão recebida ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s: any) => {
            const st = STATUS_LABEL[s.status as keyof typeof STATUS_LABEL]
            return (
              <div key={s.id} className="bg-white rounded-xl border border-border/60 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm">{s.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-[#6699F3] hover:underline flex items-center gap-1 mb-1.5">
                        {s.url} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {s.what_they_sell && (
                      <p className="text-xs text-muted-foreground mb-1"><strong>Vende:</strong> {s.what_they_sell}</p>
                    )}
                    {s.notes && (
                      <p className="text-xs text-muted-foreground"><strong>Obs:</strong> {s.notes}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Por {s.profiles?.full_name ?? 'aluna'} em {new Date(s.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  {s.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <form action={approve.bind(null, s.id)}>
                        <button className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
                          Aprovar
                        </button>
                      </form>
                      <form action={reject.bind(null, s.id)}>
                        <button className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                          Rejeitar
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
