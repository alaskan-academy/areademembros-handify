/**
 * Traduz os erros do Supabase Auth, que chegam sempre em inglês.
 *
 * Existe porque a mensagem crua vazava para a tela em vários pontos — a admin
 * via "Password is known to be weak and easy to guess" ao trocar a senha de
 * uma aluna — e, onde havia tradução, o caso da senha caía num genérico
 * "Erro ao criar conta. Tente novamente", que faz a pessoa repetir a mesma
 * senha sem nunca descobrir o motivo.
 *
 * O público são mulheres 45+: a mensagem precisa dizer o que fazer, não só
 * que deu errado.
 */

type Regra = { quando: string[]; mensagem: string };

const REGRAS: Regra[] = [
  {
    quando: ["known to be weak", "weak and easy to guess", "pwned", "leaked"],
    mensagem:
      "Essa senha é muito comum e já apareceu em vazamentos na internet. Escolha outra — pode misturar uma palavra que você lembre com números.",
  },
  {
    quando: ["should be at least", "password is too short", "minimum length"],
    mensagem: "A senha é curta demais. Use pelo menos 8 caracteres.",
  },
  {
    quando: ["different from the old password", "should be different", "same as the old"],
    mensagem: "A nova senha precisa ser diferente da atual.",
  },
  {
    quando: ["invalid login credentials", "invalid credentials"],
    mensagem: "E-mail ou senha incorretos.",
  },
  {
    quando: ["email not confirmed"],
    mensagem: "Confirme seu e-mail antes de entrar.",
  },
  {
    quando: ["already registered", "already exists", "already been registered"],
    mensagem: "Este e-mail já está cadastrado. Tente fazer login.",
  },
  {
    quando: ["unable to validate email", "invalid email", "email address is invalid"],
    mensagem: "Esse e-mail não parece válido. Confira se está escrito corretamente.",
  },
  {
    quando: ["token has expired", "invalid token", "expired"],
    mensagem: "Este link expirou. Peça um novo para continuar.",
  },
  {
    quando: ["rate limit", "for security purposes", "too many requests"],
    mensagem: "Muitas tentativas seguidas. Espere um minuto e tente de novo.",
  },
  {
    quando: ["user not found"],
    mensagem: "Não encontramos uma conta com esse e-mail.",
  },
  {
    quando: ["signups not allowed", "signup is disabled"],
    mensagem: "Os cadastros estão temporariamente fechados. Fale com o suporte.",
  },
];

/**
 * @param bruto Mensagem original do Supabase.
 * @param padrao O que dizer quando nenhuma regra reconhece o erro.
 */
export function traduzErroAuth(
  bruto: string | null | undefined,
  padrao = "Não conseguimos concluir agora. Tente de novo em instantes."
): string {
  if (!bruto) return padrao;
  const msg = bruto.toLowerCase();
  return REGRAS.find((r) => r.quando.some((t) => msg.includes(t)))?.mensagem ?? padrao;
}
