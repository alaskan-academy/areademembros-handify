/**
 * Para onde mandar a aluna depois de entrar.
 *
 * Mora fora de `(auth)/actions.ts` porque aquele arquivo é `"use server"`, e ali
 * todo export precisa ser função async — uma função pura exportada de lá quebra
 * o build.
 *
 * O destino vem de um campo de formulário, logo é de fora: aceitar qualquer
 * coisa transformaria o login num trampolim para site externo, bastando mandar
 * para a aluna um `/login?redirect=https://...` — ela digitaria a senha na
 * Handify e terminaria noutro lugar, achando que continua aqui.
 *
 * Barrados: endereço absoluto, protocol-relative (`//outro.com`, que o navegador
 * lê como outro domínio) e a variante com barra invertida, que alguns
 * navegadores normalizam para `//`. E as telas de autenticação, senão entrar
 * devolveria a aluna para a tela de entrar.
 */
export function destinoSeguro(valor: FormDataEntryValue | null): string {
  const padrao = "/cursos";
  if (typeof valor !== "string" || !valor) return padrao;
  if (!valor.startsWith("/")) return padrao;
  if (valor.startsWith("//") || valor.startsWith("/\\")) return padrao;
  const caminho = valor.split("?")[0].split("#")[0];
  const proibidos = ["/login", "/cadastro", "/recuperar-senha", "/nova-senha", "/auth"];
  if (proibidos.some((p) => caminho === p || caminho.startsWith(`${p}/`))) return padrao;
  return valor;
}
