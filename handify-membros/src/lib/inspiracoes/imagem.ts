/**
 * URLs de imagem enxutas para o acervo de Inspirações.
 *
 * MEDIDO EM 24/09/2026, nas 12 imagens publicadas hoje (baixando cada arquivo):
 *
 *   originais, direto do Storage ............ 6.301.298 bytes (6.153,6 KB)
 *   next/image w=384 q=75 ...................   170.338 bytes (  166,3 KB) → 37x menor
 *   next/image w=640 q=75 ...................   335.036 bytes (  327,2 KB) → 19x menor
 *   transformador do Supabase w=384 ......... 403 FeatureNotEnabled em 7 das 12
 *
 * Por que next/image e não o `/render/image/` do próprio Supabase: 7 das 12 imagens
 * moram no projeto antigo (ozsbyscxcpijyvnjlkpw), que não tem o transformador
 * habilitado — devolve 403 FeatureNotEnabled — e são justamente as mais pesadas
 * (1,0 a 1,5 MB cada, PNG). Nas 5 em que o transformador funciona ele ainda perde:
 * 16.732 bytes contra 6.084 do next/image, mesma imagem, mesma largura.
 *
 * O endpoint `/_next/image` é exigente, e foi conferido em produção:
 *   - qualidade: só `q=75` responde 200. `q=70` e `q=50` devolvem 400.
 *   - largura: só os valores de LARGURAS_ACEITAS. `w=320` devolve 400, `w=256` e `w=384` não.
 *   - host: precisa estar em `images.remotePatterns` do next.config.ts.
 *     Fora da lista é 400 Bad Request — em produção isso vira imagem quebrada na tela,
 *     não erro de build (a validação do next/image só lança fora de produção).
 */

/**
 * Espelho de `images.remotePatterns` em next.config.ts. Host fora daqui não pode
 * ir para `/_next/image` — o otimizador responde 400 e a aluna vê imagem quebrada.
 * Há um teste que compara esta lista com o next.config.ts para as duas não desencontrarem.
 */
export const HOSTS_OTIMIZAVEIS = [
  'fjcdcvywdiagzovqqcpc.supabase.co',
  'ozsbyscxcpijyvnjlkpw.supabase.co',
  'img.youtube.com',
  'cdn.pandavideo.com',
] as const

/**
 * Larguras que o otimizador aceita: `imageSizes` + `deviceSizes` padrão do Next.
 * Pedir um valor fora desta lista devolve 400 (conferido: w=320 → 400).
 */
export const LARGURAS_ACEITAS = [
  16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840,
] as const

/** Único valor de qualidade aceito hoje (`images.qualities` padrão do Next 16). */
export const QUALIDADE = 75

/**
 * Capa de um vídeo do Panda, a partir da URL de embed guardada em `media[].url`.
 *
 * O embed é `https://player-vz-<biblioteca>.tv.pandavideo.com.br/embed/?v=<id>`,
 * que não é imagem nenhuma — mandar essa URL para o `/_next/image` devolve 400 e a
 * aluna vê o ícone de imagem quebrada. A capa de verdade mora em
 * `https://cdn.pandavideo.com/<biblioteca>/<id>/thumbnail.jpg`, host que já está em
 * `images.remotePatterns` (entrou por causa da tela de métricas de vídeo).
 *
 * Conferido em 24/09 nos 4 vídeos do carrossel de tutorial de laço: 200 image/jpeg,
 * 17 a 24 KB cada.
 *
 * Devolve `null` quando a URL não é um embed do Panda — aí cabe ao chamador decidir.
 */
export function capaDoPanda(url: string | null | undefined): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (!parsed.hostname.endsWith('.tv.pandavideo.com.br')) return null

  const video = parsed.searchParams.get('v')
  if (!video || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(video)) return null

  const biblioteca = parsed.hostname.split('.')[0].replace(/^player-/, '')
  if (!/^vz-[0-9a-z-]+$/i.test(biblioteca)) return null

  return `https://cdn.pandavideo.com/${biblioteca}/${video}/thumbnail.jpg`
}

/** `true` quando a URL pode passar pelo `/_next/image` sem tomar 400. */
export function podeOtimizar(url: string | null | undefined): boolean {
  if (!url) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    // Caminho relativo (`/algo.png`) é servido pelo próprio app: o otimizador aceita.
    return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  return (HOSTS_OTIMIZAVEIS as readonly string[]).includes(parsed.hostname)
}

/** Arredonda para cima até a largura aceita mais próxima. Nunca serve menos pixel do que o pedido. */
export function larguraAceita(px: number): number {
  const alvo = Math.ceil(px)
  for (const l of LARGURAS_ACEITAS) if (l >= alvo) return l
  return LARGURAS_ACEITAS[LARGURAS_ACEITAS.length - 1]
}

/**
 * Tolerância de 10% só no degrau de tela retina: se o degrau de baixo já cobre 90%
 * do alvo, ele serve.
 *
 * MEDIDO nas 4 fotos da primeira tela de /inspiracoes, caixa de 341px em tela 2x
 * (alvo 682px): subir de w=640 para w=750 custa +58% de bytes (124,6 KB → 197,1 KB)
 * e entrega +17% de pixel. A 640 a imagem ainda sai a 1,88x numa caixa de 341px —
 * nenhuma aluna enxerga a diferença, e são 72 KB a menos por tela no 4G dela.
 *
 * Isto vale só para 2x ou mais. No degrau de 1x a regra é a de cima, arredondando
 * sempre para cima, porque aí a perda apareceria na tela.
 */
export function larguraRetina(px: number): number {
  const paraCima = larguraAceita(px)
  const indice = (LARGURAS_ACEITAS as readonly number[]).indexOf(paraCima)
  const abaixo = indice > 0 ? LARGURAS_ACEITAS[indice - 1] : null
  return abaixo !== null && abaixo >= px * 0.9 ? abaixo : paraCima
}

/**
 * URL de uma imagem na largura pedida. Devolve a URL original intacta quando o host
 * não está na allowlist — melhor a imagem pesada do que a imagem quebrada.
 */
export function urlOtimizada(url: string, larguraPx: number): string {
  if (!podeOtimizar(url)) return url
  const w = larguraAceita(larguraPx)
  return `/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=${QUALIDADE}`
}

/**
 * Props prontas para um `<img>` comum (sem next/image), dado o tamanho em CSS pixels
 * em que a imagem aparece na tela. O `srcSet` usa descritores `x`, então não precisa
 * de `sizes`: o próprio aparelho escolhe pela densidade de tela — 2x mantém a nitidez
 * no retina sem baixar o arquivo de 1 MB.
 *
 * Uso:
 *   <img {...imgOtimizada(post.media[0].url, 341)} loading="lazy" decoding="async" alt={...} />
 */
export function imgOtimizada(
  url: string,
  larguraCss: number,
  opcoes?: { densidadeMaxima?: number },
): { src: string; srcSet?: string } {
  if (!podeOtimizar(url)) return { src: url }

  const densidadeMaxima = opcoes?.densidadeMaxima ?? 2
  const candidatos: { d: number; w: number }[] = [{ d: 1, w: larguraAceita(larguraCss) }]
  for (let d = 2; d <= densidadeMaxima; d++) {
    candidatos.push({ d, w: larguraRetina(larguraCss * d) })
  }

  // Densidades diferentes podem cair na mesma largura aceita; nesse caso o srcSet
  // repetido só engana o browser, então fica só o primeiro.
  const unicos = candidatos.filter((c, i) => candidatos.findIndex(o => o.w === c.w) === i)

  return {
    src: urlOtimizada(url, larguraCss),
    srcSet: unicos.map(c => `${urlOtimizada(url, c.w)} ${c.d}x`).join(', '),
  }
}
