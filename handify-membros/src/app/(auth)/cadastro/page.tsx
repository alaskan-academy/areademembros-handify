"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Cake, Phone, CreditCard } from "lucide-react";
import { cadastroAction } from "../actions";
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

const initialState = { error: undefined, success: undefined, fieldErrors: undefined };

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}

export default function CadastroPage() {
  const [state, formAction, isPending] = useActionState(cadastroAction, initialState);
  const [birthDate, setBirthDate] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
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
        <CardTitle className="text-2xl">Criar conta</CardTitle>
        <CardDescription>
          Você só fará isso uma vez — depois é só entrar com e-mail e senha.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4">
          {state?.error && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
            >
              {state.error}
            </div>
          )}

          <>
            <div className="space-y-2">
                <Label htmlFor="full_name">Nome completo</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
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
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  autoComplete="email"
                  required
                  disabled={isPending}
                  aria-invalid={!!fe.email}
                />
                <FieldError msg={fe.email} />
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
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
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
                  <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
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
                <p className="text-xs text-muted-foreground">
                  Para promoções especiais na sua data!
                </p>
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
            </>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Criando conta e entrando…" : "Criar conta"}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            Já tem conta?{" "}
            <Link
              href="/login"
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              Entrar
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
