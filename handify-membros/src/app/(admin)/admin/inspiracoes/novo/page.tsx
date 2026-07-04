import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { InspiracaoForm } from '@/components/admin/inspiracoes/InspiracaoForm'

export const metadata = { title: 'Admin — Novo Post de Inspiração | Handify' }

export default async function NovoInspiracaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const service = createServiceClient()
  const [{ data: courses }, { data: categoriesRaw }] = await Promise.all([
    service.from('courses').select('id, title').eq('published', true).order('title'),
    service.from('categories').select('id, name, slug').order('name'),
  ])
  const categories = (categoriesRaw ?? []) as { id: string; name: string; slug: string }[]

  return (
    <div className="max-w-3xl mx-auto">
      <InspiracaoForm adminId={user.id} courses={courses ?? []} categories={categories} />
    </div>
  )
}
