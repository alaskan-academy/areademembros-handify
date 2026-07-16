"use client";

import { useActionState, useState } from "react";
import { Cake, Phone, CreditCard } from "lucide-react";
import { completarAtivarAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  token: string;
  email: string;
  fullName: string;
  cpf: string;
  phone: string;
}

const initialState = { error: undefined, fieldErrors: undefined };

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}

export default function CompletarAtivarForm({ token, email, fullName, cpf, phone }: Props) {
  const [state, formAction, isPending] = useActionState(
    completarAtivarAction,
    initialState
  );

  const [birthDate, setBirthDate] = useState("");
  const [nameVal, setNameVal] = useState(fullName);
  const [phoneVal, setPhoneVal] = useState(phone);
  const [cpfVal, setCpfVal] = useState(cpf);

  const fe = state?.fieldErrors ?? {};

  function handleBirthDate(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
    if (v.length > 5) v = v.slice(0, 5) + "/" + v.slice(5);
    if (v.length > 10) v = v.slice(0, 10);
    setBirthDate(v);
  }

  function birthToISO(v: string) {
    const [d, m, y] = v.split("/");
    if (d && m && y?.length === 4) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return "";
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Criar minha conta</CardTitle>
        <CardDescription className="text-foreground/80 text-sm leading-relaxed">
          <span className="font-semibold text-[#6699F3]">Fique tranquila(o), é rapidinho!</span>{" "}
          Você faz esse cadastro só uma vez — depois é só entrar com e-mail e senha.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        {/* Token hidden */}
        <input type="hidden" name="token" value={token} />

        <CardContent className="space-y-4">
          {state?.error && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
            >
              {state.error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="full_name">Nome completo</Label>
            <Input
              id="full_name"
              name="full_name"
              type="text"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              placeholder="Maria Silva"
              autoComplete="name"
              required
              disabled={isPending}
              aria-invalid={!!fe.full_name}
            />
            <FieldError msg={fe.full_name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              readOnly
              disabled
              className="bg-muted cursor-not-allowed opacity-70"
            />
            <p className="text-xs text-[#999]">O e-mail não pode ser alterado aqui.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-[#6699F3]" />
              WhatsApp
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={phoneVal}
              onChange={(e) => setPhoneVal(e.target.value)}
              placeholder="(11) 99999-9999"
              autoComplete="tel"
              required
              disabled={isPending}
              aria-invalid={!!fe.phone}
            />
            <FieldError msg={fe.phone} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf" className="flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-[#6699F3]" />
              CPF
            </Label>
            <Input
              id="cpf"
              name="cpf"
              type="text"
              value={cpfVal}
              onChange={(e) => setCpfVal(e.target.value)}
              placeholder="000.000.000-00"
              autoComplete="off"
              inputMode="numeric"
              maxLength={14}
              required
              disabled={isPending}
              aria-invalid={!!fe.cpf}
            />
            <FieldError msg={fe.cpf} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date_of_birth" className="flex items-center gap-1.5">
              <Cake className="w-4 h-4 text-[#6699F3]" />
              Data de nascimento
              <span className="text-[#999] font-normal text-xs">(opcional)</span>
            </Label>
            <Input
              id="date_of_birth"
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              value={birthDate}
              onChange={handleBirthDate}
              maxLength={10}
              autoComplete="bday"
              disabled={isPending}
            />
            <input type="hidden" name="date_of_birth" value={birthToISO(birthDate)} />
            <p className="text-xs text-[#999]">Para promoções especiais na sua data!</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <PasswordInput
              id="password"
              name="password"
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              required
              disabled={isPending}
              aria-invalid={!!fe.password}
            />
            <FieldError msg={fe.password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirmar senha</Label>
            <PasswordInput
              id="confirm_password"
              name="confirm_password"
              placeholder="••••••••"
              autoComplete="new-password"
              required
              disabled={isPending}
              aria-invalid={!!fe.confirm_password}
            />
            <FieldError msg={fe.confirm_password} />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 bg-white border-t-0 rounded-b-xl">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Criando conta e entrando…" : "Criar conta e acessar meus cursos"}
          </Button>

          <p className="text-xs text-center text-[#aaa]">
            Problemas com o acesso?{" "}
            <a
              href="https://wa.me/message/ZVYBKLSWPO7OM1"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6699F3] underline-offset-4 hover:underline"
            >
              Falar com suporte
            </a>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
