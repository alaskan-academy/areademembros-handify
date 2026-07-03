'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function uploadInspiracaoImage(
  formData: FormData
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return { error: 'Sem permissão' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Nenhum arquivo enviado' }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) return { error: 'Formato inválido' }
  if (file.size > 10 * 1024 * 1024) return { error: 'Imagem muito grande (máx. 10 MB)' }

  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `inspiracoes/${crypto.randomUUID()}.${ext}`

  const service = createServiceClient()
  const { error: uploadError } = await service.storage
    .from('community')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) return { error: `Erro ao enviar: ${uploadError.message}` }

  const { data: { publicUrl } } = service.storage.from('community').getPublicUrl(path)
  return { url: publicUrl }
}
