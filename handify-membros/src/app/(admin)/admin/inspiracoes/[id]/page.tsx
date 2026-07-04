import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { InspiracaoForm } from '@/components/admin/inspiracoes/InspiracaoForm'

export const metadata = { title: 'Admin — Editar Inspiração | Handify' }

export default async function EditInspiracaoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const service = createServiceClient()
  const [
    { data: post },
    { data: courses },
    { data: categoriesRaw },
  ] = await Promise.all([
    service.from('inspiration_posts').select('*').eq('id', id).single(),
    service.from('courses').select('id, title').eq('published', true).order('title'),
    service.from('categories').select('id, name, slug').order('name'),
  ])
  const categories = (categoriesRaw ?? []) as { id: string; name: string; slug: string }[]

  if (!post) notFound()

  return (
    <div className="max-w-3xl mx-auto">
      <InspiracaoForm post={post as any} adminId={user.id} courses={courses ?? []} categories={categories} />
    </div>
  )
}
