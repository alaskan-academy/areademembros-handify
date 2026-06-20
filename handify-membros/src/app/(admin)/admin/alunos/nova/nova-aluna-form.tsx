"use client";

import { useActionState } from "react";
import { createStudentAction } from "./actions";

export default function NovaAlunaForm() {
  const [state, action, pending] = useActionState(createStudentAction, {});

  return (
    <form action={action} className="handify-card p-6 space-y-4">
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          {state.error}
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-foreground/70 mb-1.5 block">
          Nome completo *
        </label>
        <input
          name="full_name"
          type="text"
          required
          minLength={2}
          placeholder="Maria Silva"
          className="w-full text-sm px-3 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground/70 mb-1.5 block">
          E-mail *
        </label>
        <input
          name="email"
          type="email"
          required
          placeholder="maria@exemplo.com"
          className="w-full text-sm px-3 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground/70 mb-1.5 block">
          Senha temporária
        </label>
        <input
          name="password"
          type="password"
          minLength={8}
          placeholder="Mín. 8 caracteres (opcional — gera automático se vazio)"
          className="w-full text-sm px-3 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Se deixar em branco, uma senha aleatória segura será gerada.
          A aluna pode redefinir pelo &quot;Esqueci minha senha&quot;.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-[#6699F3] hover:bg-[#5580d4] transition-colors disabled:opacity-50"
      >
        {pending ? "Criando conta…" : "Criar aluna"}
      </button>
    </form>
  );
}
