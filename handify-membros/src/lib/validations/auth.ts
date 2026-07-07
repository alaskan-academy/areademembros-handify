import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

export const cadastroSchema = z
  .object({
    full_name: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(100),
    email: z.string().email("E-mail inválido"),
    phone: z.string().min(1, "WhatsApp obrigatório"),
    cpf: z.string().refine(
      (v) => v.replace(/\D/g, "").length === 11,
      "CPF inválido. Verifique e tente novamente."
    ),
    password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "As senhas não coincidem",
    path: ["confirm_password"],
  });

export const recuperarSenhaSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

export const novaSenhaSchema = z
  .object({
    password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "As senhas não coincidem",
    path: ["confirm_password"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type CadastroInput = z.infer<typeof cadastroSchema>;
export type RecuperarSenhaInput = z.infer<typeof recuperarSenhaSchema>;
export type NovaSenhaInput = z.infer<typeof novaSenhaSchema>;
