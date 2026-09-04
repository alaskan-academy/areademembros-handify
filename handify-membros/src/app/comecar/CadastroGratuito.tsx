'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2 } from 'lucide-react'
import { cadastroAction } from '../(auth)/actions'

/**
 * Cadastro da página das ferramentas grátis. Quatro campos e pronto: nome,
 * WhatsApp, e-mail e senha. Sem CPF — ele é pedido quando ela compra um curso,
 * que é quando serve para alguma coisa.
 */

const initialState = { error: undefined, success: undefined, fieldErrors: undefined }
const INPUT =
  'mt-1 w-full rounded-lg border border-border bg-white px-4 py-3 text-base min-h-[52px] focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40'

function Erro({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-600 mt-1">{msg}</p>
}

export default function CadastroGratuito() {
  const [state, formAction, pendente] = useActionState(cadastroAction, initialState)
  const [telefone, setTelefone] = useState('')
  const fe = state?.fieldErrors ?? {}

  function mascaraTelefone(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="origem" value="comecar" />

      <label className="block text-sm font-medium text-[#2D2D2D]">
        Seu nome
        <input name="full_name" placeholder="Como você quer ser chamada" className={INPUT} autoComplete="name" required />
        <Erro msg={fe.full_name} />
      </label>

      <label className="block text-sm font-medium text-[#2D2D2D]">
        WhatsApp
        <input
          name="phone"
          value={telefone}
          onChange={e => setTelefone(mascaraTelefone(e.target.value))}
          placeholder="(11) 99999-9999"
          inputMode="tel"
          autoComplete="tel"
          className={INPUT}
          required
        />
        <Erro msg={fe.phone} />
      </label>

      <label className="block text-sm font-medium text-[#2D2D2D]">
        Seu e-mail
        <input name="email" type="email" placeholder="voce@email.com" className={INPUT} autoComplete="email" required />
        <Erro msg={fe.email} />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block text-sm font-medium text-[#2D2D2D]">
          Crie uma senha
          <input name="password" type="password" placeholder="Ao menos 8 letras ou números" className={INPUT} autoComplete="new-password" required />
          <Erro msg={fe.password} />
        </label>
        <label className="block text-sm font-medium text-[#2D2D2D]">
          Repita a senha
          <input name="confirm_password" type="password" placeholder="A mesma de novo" className={INPUT} autoComplete="new-password" required />
          <Erro msg={fe.confirm_password} />
        </label>
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-[#6699F3] text-white text-base font-bold min-h-[56px] hover:bg-[#5580d4] disabled:opacity-60 handify-transition"
      >
        {pendente ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Criar minha conta grátis <ArrowRight className="w-5 h-5" /></>}
      </button>

      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        É grátis e leva um minuto. Não pedimos cartão nem CPF.
        <br />
        Já tem conta? <Link href="/login" className="text-[#6699F3] font-semibold underline">Entrar</Link>
      </p>
    </form>
  )
}
