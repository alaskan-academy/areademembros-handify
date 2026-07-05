# Plano: Onboarding — Tutorial de Primeiro Acesso

## Contexto

A plataforma está completa e recheada de funcionalidades (player, progresso, comunidade, ferramentas, busca global, certificados, etc.). O objetivo do onboarding é garantir que alunas — especialmente o público 45+ que acessa majoritariamente pelo celular — descubram e saibam usar todos os recursos sem precisar de suporte.

**Decisão de design:**
- ❌ Tour guiado (Intro.js) — descartado: péssimo em mobile, setas desalinham
- ❌ Vídeo no modal — descartado para modal: autoplay bloqueado em mobile, consome dados
- ✅ **Modal de boas-vindas + Checklist de primeiros passos no dashboard**

A aula de apresentação da plataforma (vídeo da professora) fica como **primeiro item do checklist**, dentro do player normal — funciona igual em mobile e desktop.

---

## O que será entregue

### 1. Modal de boas-vindas (`OnboardingModal`)

Exibido **uma única vez** no primeiro acesso após login, quando `profiles.onboarding_dismissed_at IS NULL`.

- Fullscreen no mobile, centralizado (max-w-lg) no desktop
- 5 cards com ícone + título + descrição curta, mostrando as principais áreas:
  | Ícone | Título | Descrição |
  |-------|--------|-----------|
  | 🎬 | Suas Aulas | Assista onde estiver, no celular ou computador |
  | 📈 | Seu Progresso | Acompanhe aulas concluídas e conquiste seu certificado |
  | 💬 | Comunidade | Tire dúvidas e compartilhe seus projetos no fórum |
  | 🔧 | Ferramentas | Calculadoras e lista de fornecedores para o seu negócio |
  | 🔍 | Busca Rápida | Encontre qualquer aula ou conteúdo na plataforma |
- Botão principal: **"Vamos começar!"** → fecha o modal e marca `onboarding_dismissed_at = now()`
- Link secundário: "Pular por enquanto" → mesmo comportamento
- **Não** bloqueia a navegação (pode fechar clicando fora)

### 2. Widget de Primeiros Passos (`OnboardingChecklist`)

Card colapsável no **dashboard da aluna** (`/dashboard`). Some quando todos os passos forem concluídos ou a aluna clicar em "Já sei usar tudo".

**6 passos rastreados:**

| # | Passo | Como é marcado como feito |
|---|-------|--------------------------|
| 1 | Assista à apresentação da plataforma | Clica no link → abre aula de orientação |
| 2 | Assista sua primeira aula | `lesson_progress` tem pelo menos 1 registro |
| 3 | Complete seu perfil | `profiles.avatar_url IS NOT NULL AND profiles.bio IS NOT NULL` |
| 4 | Visite o fórum do seu curso | Navegação para `/comunidade/forum/[curso]` |
| 5 | Use a busca global | Abertura do modal de busca (`Ctrl+K`) |
| 6 | Conheça as ferramentas | Navegação para `/ferramentas` |

- Barra de progresso: `(passos_concluídos / 6) * 100%`
- Passos 2 e 3 são detectados server-side; passos 1, 4, 5, 6 são marcados via Server Action quando a aluna executa a ação
- Card colapsável: no mobile aparece recolhido por padrão

---

## Banco de dados — mudanças necessárias

### Migration em `profiles`

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_steps jsonb NOT NULL DEFAULT '{}';
```

`onboarding_steps` exemplo:
```json
{
  "watched_intro": true,
  "visited_forum": false,
  "used_search": false,
  "visited_tools": false
}
```

Os passos "assistiu primeira aula" e "perfil completo" são derivados de outras tabelas (não precisam de coluna própria).

---

## Arquivos a criar

### `src/components/onboarding/OnboardingModal.tsx`
Client component. Recebe `show: boolean`. Usa `createClient()` + Server Action para gravar `onboarding_dismissed_at`. Animação de entrada suave (fade + slide-up). Renderiza os 5 cards de feature.

### `src/components/onboarding/OnboardingChecklist.tsx`
Client component. Recebe `steps: OnboardingSteps` e `profile: Pick<Profile, 'avatar_url' | 'bio'>` e `hasLesson: boolean`. Gerencia estado colapsado/expandido. Chama Server Action ao marcar passos manuais (visitar fórum, usar busca, etc.).

### `src/app/(student)/dashboard/onboarding-actions.ts`
Server Actions:
```ts
dismissOnboarding()         // grava onboarding_dismissed_at = now()
markOnboardingStep(step)    // atualiza onboarding_steps jsonb
```

---

## Arquivos a modificar

### `src/app/(student)/dashboard/page.tsx`
Adicionar ao `Promise.all` existente:
```ts
service.from("profiles").select("onboarding_dismissed_at, onboarding_steps, avatar_url, bio").eq("id", userId).single()
service.from("lesson_progress").select("id").eq("user_id", userId).limit(1)
```
Passar `showOnboarding`, `checklistSteps` e `hasLesson` para o componente de dashboard.

### `src/components/student/dashboard/DashboardClient.tsx` (ou equivalente)
- Renderizar `<OnboardingModal show={showOnboarding} />` no topo
- Renderizar `<OnboardingChecklist ... />` como primeiro card do dashboard quando checklist não estiver 100% completo

### Busca global (componente de busca)
Ao abrir o modal de busca, disparar `markOnboardingStep('used_search')` se ainda não marcado.

### `/ferramentas/page.tsx`
Ao carregar a página, disparar `markOnboardingStep('visited_tools')` se ainda não marcado.

### `/comunidade/forum/[curso]/page.tsx`
Ao carregar a página, disparar `markOnboardingStep('visited_forum')` se ainda não marcado.

---

## Tipos TypeScript

```ts
type OnboardingSteps = {
  watched_intro?: boolean
  visited_forum?: boolean
  used_search?: boolean
  visited_tools?: boolean
}
```

---

## Aula de orientação (conteúdo — fora do código)

Criar no admin uma aula especial "Como usar a plataforma Handify" em um módulo de orientação, com `is_preview: true` (acessível sem matrícula em curso). O link do passo 1 do checklist aponta para essa aula. A professora/Jessica grava um vídeo de 3–5 min apresentando cada funcionalidade.

---

## Verificação pós-implementação

1. Primeiro login de aluna nova → modal aparece
2. Fechar modal → não aparece mais em reloads subsequentes
3. Checklist aparece no dashboard com progresso correto
4. Assistir aula → passo 2 aparece marcado no checklist
5. Completar perfil (foto + bio) → passo 3 marcado
6. Visitar fórum → passo 4 marcado
7. Abrir busca → passo 5 marcado
8. Visitar ferramentas → passo 6 marcado
9. Todos os passos concluídos → checklist some do dashboard
10. Mobile e desktop: modal responsivo, checklist colapsável
11. Build sem erros TypeScript
