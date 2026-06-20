# Handify Membros — Dev Notes

PRD e arquitetura completa em: `../CLAUDE.md`
Plano de execução em: `../PLAN.md`

## Comandos

```bash
npm run dev      # desenvolvimento (http://localhost:3000)
npm run build    # build de produção
npm run lint     # ESLint
npm run test     # Vitest
```

## Variáveis de Ambiente

Copiar `.env.local.example` → `.env.local` e preencher antes de rodar.

## Convenções

- TypeScript strict — sem `any` explícito
- Server Actions para mutações; API routes apenas para webhooks externos (`/api/webhooks/payt`)
- `use server` / `use client` explícito em todo arquivo que precisar
- Zod para validar todos os inputs de forms e webhooks
- Nunca retornar `video_panda_id` ou URL de vídeo sem verificar `enrollment` server-side
- CPF nunca exposto em JSON; apenas no PDF do certificado

## Fluxo de trabalho

- Ao final de cada alteração, sempre fazer `commit` e `push` para o remote.

## Segurança — checklist por PR

- [ ] Toda nova tabela Supabase tem RLS ativo
- [ ] Server Actions verificam role antes de mutar
- [ ] Inputs sanitizados (Zod + DOMPurify onde aplicável)
- [ ] Nenhum segredo exposto no client (`NEXT_PUBLIC_` apenas para Supabase URL e anon key)
