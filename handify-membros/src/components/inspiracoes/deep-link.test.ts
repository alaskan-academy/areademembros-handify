import { describe, it, expect } from 'vitest'
import {
  lerDeepLink,
  montarDeepLink,
  cursoBloqueadoDoPost,
  PARAM_POST,
  PARAM_COMENTARIO,
} from './deep-link'
import type { CursoDoFiltro, InspiracaoPost } from '@/lib/inspiracoes/types'

const POST_ID = '11111111-2222-4333-8444-555555555555'
const COMENTARIO_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

function curso(id: string, temAcesso: boolean): CursoDoFiltro {
  return { id, title: `Curso ${id}`, slug: `curso-${id}`, price: 197, checkoutUrl: null, temAcesso }
}

function post(dados: Partial<Pick<InspiracaoPost, 'course_id' | 'course_ids'>>) {
  return { course_id: null, course_ids: [], ...dados } as Pick<InspiracaoPost, 'course_id' | 'course_ids'>
}

describe('lerDeepLink', () => {
  it('lê post e comentário do formato combinado com a moderação', () => {
    expect(lerDeepLink({ post: POST_ID, comentario: COMENTARIO_ID })).toEqual({
      postId: POST_ID,
      comentarioId: COMENTARIO_ID,
    })
  })

  it('aceita o link só com o post', () => {
    expect(lerDeepLink({ post: POST_ID })).toEqual({ postId: POST_ID, comentarioId: null })
  })

  it('lê igual a partir de URLSearchParams', () => {
    const qs = new URLSearchParams({ [PARAM_POST]: POST_ID, [PARAM_COMENTARIO]: COMENTARIO_ID })
    expect(lerDeepLink(qs)).toEqual({ postId: POST_ID, comentarioId: COMENTARIO_ID })
  })

  it('devolve null quando não há link profundo', () => {
    expect(lerDeepLink({})).toBeNull()
    expect(lerDeepLink({ comentario: COMENTARIO_ID })).toBeNull()
  })

  // A aluna clicou numa notificação: id torto não pode derrubar a tela dela.
  it('ignora post que não é UUID', () => {
    expect(lerDeepLink({ post: 'nao-e-uuid' })).toBeNull()
    expect(lerDeepLink({ post: '' })).toBeNull()
    expect(lerDeepLink({ post: `${POST_ID}' or 1=1--` })).toBeNull()
  })

  it('abre o post mesmo quando só o comentário veio torto', () => {
    expect(lerDeepLink({ post: POST_ID, comentario: 'lixo' })).toEqual({
      postId: POST_ID,
      comentarioId: null,
    })
  })

  it('usa o primeiro valor quando o parâmetro vem repetido', () => {
    expect(lerDeepLink({ post: [POST_ID, 'outro'] })).toEqual({ postId: POST_ID, comentarioId: null })
  })
})

describe('montarDeepLink', () => {
  it('monta no formato do contrato', () => {
    expect(montarDeepLink(POST_ID, COMENTARIO_ID)).toBe(
      `/inspiracoes?post=${POST_ID}&comentario=${COMENTARIO_ID}`,
    )
  })

  it('omite o comentário quando não há', () => {
    expect(montarDeepLink(POST_ID)).toBe(`/inspiracoes?post=${POST_ID}`)
    expect(montarDeepLink(POST_ID, null)).toBe(`/inspiracoes?post=${POST_ID}`)
  })

  // Ida e volta: o que a moderação monta é o que a tela lê.
  it('o que monta é o que lê', () => {
    const url = new URL(montarDeepLink(POST_ID, COMENTARIO_ID), 'https://membros.handify.com.br')
    expect(lerDeepLink(url.searchParams)).toEqual({ postId: POST_ID, comentarioId: COMENTARIO_ID })
  })
})

describe('cursoBloqueadoDoPost', () => {
  it('deixa passar post sem curso nenhum', () => {
    expect(cursoBloqueadoDoPost(post({}), [curso('a', false)])).toBeNull()
  })

  it('deixa passar quando ela tem o curso', () => {
    expect(cursoBloqueadoDoPost(post({ course_ids: ['a'] }), [curso('a', true)])).toBeNull()
  })

  it('barra quando ela não tem o único curso do post', () => {
    const bloqueio = cursoBloqueadoDoPost(post({ course_ids: ['a'] }), [curso('a', false)])
    expect(bloqueio?.id).toBe('a')
  })

  // A dica de essência serve a saboaria e às quatro de velas: basta ter uma.
  it('deixa passar quando ela tem pelo menos um dos cursos do post', () => {
    const cursos = [curso('a', false), curso('b', true), curso('c', false)]
    expect(cursoBloqueadoDoPost(post({ course_ids: ['a', 'b', 'c'] }), cursos)).toBeNull()
  })

  it('barra quando não tem nenhum dos cursos do post', () => {
    const cursos = [curso('a', false), curso('b', false)]
    expect(cursoBloqueadoDoPost(post({ course_ids: ['a', 'b'] }), cursos)?.id).toBe('a')
  })

  it('considera o course_id legado junto com course_ids', () => {
    expect(cursoBloqueadoDoPost(post({ course_id: 'a' }), [curso('a', false)])?.id).toBe('a')
    expect(cursoBloqueadoDoPost(post({ course_ids: ['a'], course_id: 'b' }), [curso('a', false), curso('b', true)])).toBeNull()
  })

  // Não sei dizer não é o mesmo que não pode: ela já vê esse post no feed.
  it('deixa passar quando o curso do post não está na lista recebida', () => {
    expect(cursoBloqueadoDoPost(post({ course_ids: ['sumiu'] }), [curso('a', false)])).toBeNull()
    expect(cursoBloqueadoDoPost(post({ course_ids: ['a'] }), [])).toBeNull()
  })
})
