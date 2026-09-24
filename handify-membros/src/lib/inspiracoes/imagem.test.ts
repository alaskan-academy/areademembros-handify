import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  HOSTS_OTIMIZAVEIS,
  LARGURAS_ACEITAS,
  QUALIDADE,
  podeOtimizar,
  larguraAceita,
  larguraRetina,
  urlOtimizada,
  imgOtimizada,
  capaDoPanda,
} from './imagem'

const FOTO_NOVA =
  'https://fjcdcvywdiagzovqqcpc.supabase.co/storage/v1/object/public/community/inspiracoes/3a780400-038a-4f1d-9c4a-973d2461209a.webp'
const FOTO_ANTIGA =
  'https://ozsbyscxcpijyvnjlkpw.supabase.co/storage/v1/object/public/community/inspiracoes/c6dc08f3-7d4a-47c7-b951-97ec88207877.png'
// Carrossel real cujo primeiro item é vídeo do Panda: 8 alunas têm este post salvo.
const EMBED_PANDA =
  'https://player-vz-9ca262d0-284.tv.pandavideo.com.br/embed/?v=46a981ca-f057-467b-a27f-eae0db6e0d54'

describe('podeOtimizar', () => {
  it('aceita os dois projetos de Storage que servem o acervo', () => {
    expect(podeOtimizar(FOTO_NOVA)).toBe(true)
    expect(podeOtimizar(FOTO_ANTIGA)).toBe(true)
  })

  it('recusa o embed do Panda — este host devolve 400 no /_next/image', () => {
    expect(podeOtimizar(EMBED_PANDA)).toBe(false)
  })

  it('recusa vazio, nulo e URL quebrada', () => {
    expect(podeOtimizar('')).toBe(false)
    expect(podeOtimizar(null)).toBe(false)
    expect(podeOtimizar(undefined)).toBe(false)
    expect(podeOtimizar('nao-e-url')).toBe(false)
    expect(podeOtimizar('//sem-protocolo.com/a.png')).toBe(false)
  })

  it('recusa data: e blob:, que o otimizador não busca', () => {
    expect(podeOtimizar('data:image/png;base64,iVBORw0KGgo=')).toBe(false)
    expect(podeOtimizar('blob:https://membros.handify.com.br/abc')).toBe(false)
  })

  it('aceita caminho relativo, servido pelo próprio app', () => {
    expect(podeOtimizar('/icon.png')).toBe(true)
  })
})

describe('larguraAceita', () => {
  it('arredonda para cima até um valor da lista', () => {
    // 165px é a largura real do card no celular de 375px (grid de 2 colunas,
    // container max-w-2xl px-4, gap-3). Em tela 2x vira 330 → 384.
    expect(larguraAceita(165)).toBe(256)
    expect(larguraAceita(330)).toBe(384)
    // w=320 devolve 400 em produção; nunca pode sair daqui.
    expect(larguraAceita(320)).toBe(384)
    expect(larguraAceita(341)).toBe(384)
    expect(larguraAceita(682)).toBe(750)
  })

  it('nunca devolve largura fora da lista aceita', () => {
    for (let px = 1; px <= 2000; px += 7) {
      expect(LARGURAS_ACEITAS).toContain(larguraAceita(px))
    }
  })

  it('não estoura o teto', () => {
    expect(larguraAceita(99999)).toBe(3840)
  })
})

describe('larguraRetina', () => {
  it('aceita o degrau de baixo quando ele cobre 90% do alvo', () => {
    // Caixa de 341px em tela 2x: alvo 682. Medido: w=750 custa +58% de bytes
    // sobre w=640 e entrega +17% de pixel. 640 numa caixa de 341 ainda é 1,88x.
    expect(larguraRetina(682)).toBe(640)
  })

  it('não desce quando o degrau de baixo ficaria curto demais', () => {
    expect(larguraRetina(330)).toBe(384) // card de 165px em tela 2x
    expect(larguraRetina(1023)).toBe(1080) // caixa de 341px em tela 3x
  })

  it('nunca devolve largura fora da lista aceita', () => {
    for (let px = 1; px <= 2000; px += 7) {
      expect(LARGURAS_ACEITAS).toContain(larguraRetina(px))
    }
  })

  it('nunca entrega menos de 90% do que foi pedido', () => {
    for (let px = 1; px <= 2000; px += 7) {
      expect(larguraRetina(px)).toBeGreaterThanOrEqual(Math.min(px * 0.9, 3840))
    }
  })
})

describe('urlOtimizada', () => {
  it('monta a URL do otimizador com a qualidade que o servidor aceita', () => {
    const u = urlOtimizada(FOTO_NOVA, 341)
    expect(u).toBe(`/_next/image?url=${encodeURIComponent(FOTO_NOVA)}&w=384&q=75`)
    expect(QUALIDADE).toBe(75) // q=70 e q=50 devolvem 400 em produção
  })

  it('devolve a URL intacta quando o host está fora da allowlist', () => {
    // Melhor servir o arquivo pesado do que mandar o aparelho buscar um 400.
    expect(urlOtimizada(EMBED_PANDA, 341)).toBe(EMBED_PANDA)
  })
})

describe('imgOtimizada', () => {
  it('entrega src de 1x e srcSet de 2x para não borrar no retina', () => {
    // 341px é a largura medida da foto no feed do celular de 375px.
    const { src, srcSet } = imgOtimizada(FOTO_ANTIGA, 341)
    expect(src).toContain('w=384')
    expect(srcSet).toContain('w=384')
    expect(srcSet).toContain('w=640')
    expect(srcSet).not.toContain('w=750') // custa +58% de bytes por +17% de pixel
    expect(srcSet).toMatch(/ 1x, .* 2x$/)
  })

  it('não repete a mesma largura quando 1x e 2x caem no mesmo degrau', () => {
    // 10px: 1x → 16, 2x → 32. 3000px: 1x e 2x batem no teto 3840.
    const { srcSet } = imgOtimizada(FOTO_NOVA, 3000)
    expect(srcSet?.split(', ')).toHaveLength(1)
  })

  it('aceita pedir 3x quando a nitidez importa mais que o peso', () => {
    const { srcSet } = imgOtimizada(FOTO_NOVA, 341, { densidadeMaxima: 3 })
    expect(srcSet).toContain('3x')
    expect(srcSet).toContain('w=1080')
  })

  it('passa reto e sem srcSet quando não dá para otimizar', () => {
    expect(imgOtimizada(EMBED_PANDA, 341)).toEqual({ src: EMBED_PANDA })
  })
})

describe('capaDoPanda', () => {
  it('tira a capa da URL de embed do carrossel real', () => {
    // Conferido em produção: 200 image/jpeg, 17.202 bytes.
    expect(capaDoPanda(EMBED_PANDA)).toBe(
      'https://cdn.pandavideo.com/vz-9ca262d0-284/46a981ca-f057-467b-a27f-eae0db6e0d54/thumbnail.jpg',
    )
  })

  it('a capa cai num host que o otimizador aceita', () => {
    const capa = capaDoPanda(EMBED_PANDA)
    expect(capa).not.toBeNull()
    expect(podeOtimizar(capa)).toBe(true)
  })

  it('devolve null para o que não é embed do Panda', () => {
    expect(capaDoPanda(FOTO_NOVA)).toBeNull()
    expect(capaDoPanda('https://www.youtube.com/watch?v=abcdefghijk')).toBeNull()
    expect(capaDoPanda(null)).toBeNull()
    expect(capaDoPanda('')).toBeNull()
    expect(capaDoPanda('nao-e-url')).toBeNull()
  })

  it('devolve null quando falta o id do vídeo ou ele não é um uuid', () => {
    expect(capaDoPanda('https://player-vz-9ca262d0-284.tv.pandavideo.com.br/embed/')).toBeNull()
    expect(capaDoPanda('https://player-vz-9ca262d0-284.tv.pandavideo.com.br/embed/?v=abc')).toBeNull()
  })

  it('não cai num host parecido de fora', () => {
    expect(
      capaDoPanda('https://player-vz-1.tv.pandavideo.com.br.evil.com/embed/?v=46a981ca-f057-467b-a27f-eae0db6e0d54'),
    ).toBeNull()
  })
})

describe('allowlist x next.config.ts', () => {
  it('todo host da lista está em images.remotePatterns', () => {
    // Se alguém tirar um host do next.config.ts sem tirar daqui, o helper passa a
    // montar URLs que devolvem 400 e a aluna vê imagem quebrada. Este teste avisa.
    const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
    for (const host of HOSTS_OTIMIZAVEIS) {
      expect(config, `host ausente do next.config.ts: ${host}`).toContain(host)
    }
  })
})
