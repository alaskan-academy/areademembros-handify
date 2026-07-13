"use client";

import { useActionState, useState } from "react";
import { Lock, Eye, EyeOff, CheckCircle2, Cake, Phone } from "lucide-react";
import { activateAccount } from "./actions";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function useBirthDateMask() {
  const [value, setValue] = useState("");
  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
    if (v.length > 5) v = v.slice(0, 5) + "/" + v.slice(5);
    if (v.length > 10) v = v.slice(0, 10);
    setValue(v);
  }
  function toISO() {
    const [d, m, y] = value.split("/");
    if (d && m && y?.length === 4) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return "";
  }
  return { value, onChange, toISO };
}

function PasswordInput({
  name,
  placeholder,
  required,
}: {
  name: string;
  placeholder: string;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        name={name}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        required={required}
        minLength={8}
        className="w-full border border-border rounded-lg px-3 py-2.5 pr-10 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function ActivateForm({
  token,
  email,
  defaultName,
  defaultPhone,
}: {
  token: string;
  email: string;
  defaultName?: string;
  defaultPhone?: string;
}) {
  const router = useRouter();
  const [success, setSuccess] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const birthDate = useBirthDateMask();

  const [state, action, pending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      const res = await activateAccount(formData);
      if (res.success) {
        setSuccess(true);
        setSigningIn(true);
        const password = formData.get("password") as string;
        const supabase = createClient();
        await supabase.auth.signInWithPassword({ email, password });
        router.push("/cursos");
      }
      return res;
    },
    null
  );

  if (success || signingIn) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-border p-8 w-full max-w-md text-center space-y-4">
          <div className="flex justify-center">
            <CheckCircle2 className="w-14 h-14 text-[#72CF92]" />
          </div>
          <h1 className="text-xl font-bold">Conta criada com sucesso!</h1>
          <p className="text-muted-foreground text-sm">
            Entrando na plataforma...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4">
      {/* Faixa tricolor */}
      <div className="fixed top-0 left-0 right-0 flex h-1">
        <span className="flex-1 bg-[#6699F3]" />
        <span className="flex-1 bg-[#72CF92]" />
        <span className="flex-1 bg-[#FEC649]" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-border p-8 w-full max-w-md space-y-6">
        {/* Cabeçalho */}
        <div className="text-center space-y-1">
          <p className="text-[#6699F3] text-2xl font-black tracking-tight">
            Handify™
          </p>
          <h1 className="text-lg font-bold text-foreground">
            Criar sua conta
          </h1>
          <p className="text-foreground/80 text-sm leading-relaxed">
            <span className="font-semibold text-[#6699F3]">Esta é a primeira e única etapa.</span> Depois é só entrar com seu e-mail e senha — você nunca mais precisará fazer isso.
          </p>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="token" value={token} />

          {/* Nome completo */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input
              name="full_name"
              type="text"
              placeholder="Maria Silva"
              required
              autoComplete="name"
              defaultValue={defaultName ?? ""}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
            />
            {defaultName && (
              <p className="text-xs text-[#6699F3]">Preenchido com o nome da sua compra.</p>
            )}
          </div>

          {/* E-mail bloqueado */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              E-mail
            </label>
            <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2.5 bg-muted/40">
              <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground flex-1">{email}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              E-mail vinculado à sua compra — não pode ser alterado.
            </p>
          </div>

          {/* Senha */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Criar senha <span className="text-red-500">*</span>
            </label>
            <PasswordInput name="password" placeholder="Mínimo 8 caracteres" required />
          </div>

          {/* Confirmar senha */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Confirmar senha <span className="text-red-500">*</span>
            </label>
            <PasswordInput name="confirm_password" placeholder="Repita a senha" required />
          </div>

          {/* Telefone / WhatsApp */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-[#6699F3]" />
              WhatsApp
            </label>
            <input
              name="phone"
              type="tel"
              placeholder="(11) 99999-9999"
              autoComplete="tel"
              required
              defaultValue={defaultPhone ?? ""}
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
            />
            {defaultPhone && (
              <p className="text-xs text-[#6699F3]">Preenchido com o número da sua compra.</p>
            )}
          </div>

          {/* Data de nascimento */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Cake className="w-4 h-4 text-[#6699F3]" />
              Data de nascimento
              <span className="text-muted-foreground font-normal text-xs ml-1">(opcional)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              value={birthDate.value}
              onChange={birthDate.onChange}
              maxLength={10}
              autoComplete="bday"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
            />
            <input type="hidden" name="date_of_birth" value={birthDate.toISO()} />
            <p className="text-xs text-muted-foreground">
              Para ofertas e promoções especiais na data certa!
            </p>
          </div>

          {/* Erro */}
          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={pending}
            className="w-full bg-[#6699F3] text-white py-3 rounded-lg text-sm font-bold hover:bg-[#4d7de0] transition-colors disabled:opacity-60 disabled:cursor-not-allowed min-h-[48px]"
          >
            {pending ? "Criando conta..." : "Criar minha conta"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Já tem conta?{" "}
          <a href="/login" className="text-[#6699F3] hover:underline font-medium">
            Fazer login
          </a>
        </p>
      </div>
    </div>
  );
}
