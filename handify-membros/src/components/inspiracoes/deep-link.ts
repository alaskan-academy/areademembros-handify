import type { CursoDoFiltro, InspiracaoPost } from '@/lib/inspiracoes/types'

/**
 * O link profundo do acervo de Inspirações.
 *
 *     /inspiracoes?post=<postId>&comentario=<commentId>
 *
 * Existe porque, até aqui, um post do acervo só abria clicando nele no feed —
 * não havia URL que levasse a um post específico. Duas telas pagavam por isso:
 *
 * 1. a notificação "alguém respondeu ao seu comentário" jogava a aluna em
 *    `/inspiracoes` e ela caía no topo do feed, sem ideia de onde foi o
 *    comentário. O feed é paginado por cursor: a resposta podia estar na
 *    página 7, e ela nunca chegaria lá rolando;
 * 2. a admin, na fila de moderação, aprovava comentário sem conseguir ver o
 *    post em que ele foi escrito.
 *
 * O formato acima é contrato com a moderação e com a notificação, que geram o
 * link. Mudar o nome dos parâmetros aqui quebra os dois lados de uma vez.
 *
 * Este arquivo é só a parte pura: ler e montar o link, e decidir se a aluna
 * pode ver o post. Fica separado do componente para poder ser testado — o
 * Vitest do projeto roda em ambiente `node` e não monta React.
 */

export const PARAM_POST = 'post'
export const PARAM_COMENTARIO = 'comentario'

/** Só aceita UUID: o id vem da URL, então vira seletor e vira consulta. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface DeepLinkInspiracao {
  postId: string
  /** null quando o link aponta só para o post, sem comentário específico. */
  comentarioId: string | null
}

/** O que o Next entrega em `searchParams` (um parâmetro repetido vira array). */
export type ParamsDaUrl = Record<string, string | string[] | undefined>

function primeiro(valor: string | string[] | undefined): string | null {
  if (Array.isArray(valor)) return valor[0] ?? null
  return valor ?? null
}

/**
 * Lê `?post=` e `?comentario=` da URL.
 *
 * Devolve null quando não há link profundo OU quando o id não é um UUID.
 * Um id torto não pode derrubar a página: a aluna clicou numa notificação, o
 * pior resultado aceitável é ela ver o feed normal.
 */
export function lerDeepLink(params: ParamsDaUrl | URLSearchParams): DeepLinkInspiracao | null {
  const post = params instanceof URLSearchParams
    ? params.get(PARAM_POST)
    : primeiro(params[PARAM_POST])

  if (!post || !UUID_RE.test(post)) return null

  const comentario = params instanceof URLSearchParams
    ? params.get(PARAM_COMENTARIO)
    : primeiro(params[PARAM_COMENTARIO])

  return {
    postId: post,
    comentarioId: comentario && UUID_RE.test(comentario) ? comentario : null,
  }
}

/**
 * Monta o link no formato do contrato. A moderação e a notificação geram o
 * deles no servidor; esta versão serve para o que for montado no cliente e
 * garante que ninguém invente outro nome de parâmetro.
 */
export function montarDeepLink(postId: string, comentarioId?: string | null): string {
  const qs = new URLSearchParams({ [PARAM_POST]: postId })
  if (comentarioId) qs.set(PARAM_COMENTARIO, comentarioId)
  return `/inspiracoes?${qs.toString()}`
}

/**
 * O curso que barra a aluna neste post — ou null quando ela pode abrir.
 *
 * O acervo funciona como vitrine: no feed, o post de um curso que ela não tem
 * aparece do mesmo jeito, com o selo de cadeado. Mas o link profundo é um
 * pulo direto para dentro do conteúdo, então aqui a regra é a do curso: sem
 * acesso, ela vê o convite de compra (CursoBloqueadoModal) em cima do feed
 * normal, em vez do post aberto.
 *
 * Três casos devolvem null de propósito:
 * - post sem curso nenhum (dica solta, destaque): é de todas;
 * - post que serve a vários cursos e ela tem pelo menos um;
 * - post cujos cursos não estão na lista recebida. Aí eu não sei dizer, e
 *   barrar por não saber seria pior: ela já vê esse mesmo post no feed.
 */
export function cursoBloqueadoDoPost(
  post: Pick<InspiracaoPost, 'course_id' | 'course_ids'>,
  cursos: CursoDoFiltro[],
): CursoDoFiltro | null {
  const ids = (post.course_ids ?? []).concat(post.course_id ? [post.course_id] : [])
  if (ids.length === 0) return null

  const doPost = ids
    .map(id => cursos.find(c => c.id === id))
    .filter((c): c is CursoDoFiltro => !!c)

  if (doPost.length === 0) return null
  if (doPost.some(c => c.temAcesso)) return null

  return doPost[0]
}

/**
 * Tira `?post=` e `?comentario=` da barra de endereço sem recarregar nada.
 *
 * Roda assim que o link é lido, não na hora de fechar o modal, e o motivo é o
 * `useModalBackGuard`: ele empilha uma entrada no histórico ao abrir e chama
 * `history.back()` ao fechar. Se a URL ainda tivesse os parâmetros nesse
 * momento, o voltar cairia de novo na URL com `?post=` e reabriria o modal que
 * ela acabou de fechar — e um F5 faria o mesmo.
 *
 * Limpar antes de abrir resolve os dois: o modal vive sobre uma URL limpa, o
 * voltar fecha e fica, e o F5 traz o feed.
 */
export function limparParametrosDoDeepLink(): void {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  if (!url.searchParams.has(PARAM_POST) && !url.searchParams.has(PARAM_COMENTARIO)) return

  url.searchParams.delete(PARAM_POST)
  url.searchParams.delete(PARAM_COMENTARIO)

  // replaceState (e não o router do Next): trocar a entrada atual não dispara
  // navegação, então o feed já renderizado não é remontado nem refeito.
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}
