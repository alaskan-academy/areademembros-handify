"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Lock, Cake, Phone, CreditCard } from "lucide-react";
import { cadastroAction } from "../../actions";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Input } from "@/components/ui/input";
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

export default function CadastroEmailForm({
  email,
  defaultCpf,
  defaultPhone,
  defaultName,
}: {
  email: string;
  defaultCpf?: string;
  defaultPhone?: string;
  defaultName?: string;
}) {
  const [state, formAction, isPending] = useActionState(cadastroAction, initialState);
  const [birthDate, setBirthDate] = useState("");
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
        <CardTitle className="text-2xl">Criar sua conta</CardTitle>
        <CardDescription>
          Seu acesso já está liberado! Crie sua senha para entrar.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4">
          {state?.error && (
            <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          {state?.success && (
            <div role="status" className="rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
              {state.success}
            </div>
          )}

          {!state?.success && (
            <>
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome completo</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  type="text"
                  placeholder="Maria Silva"
                  autoComplete="name"
                  defaultValue={defaultName ?? ""}
                  required
                  disabled={isPending}
                  aria-invalid={!!fe.full_name}
                />
                {defaultName && !fe.full_name && (
                  <p className="text-xs text-[#6699F3]">
                    Preenchido automaticamente com o nome da sua compra.
                  </p>
                )}
                <FieldError msg={fe.full_name} />
              </div>

              {/* E-mail bloqueado */}
              <div className="space-y-2">
                <Label>E-mail</Label>
                <div className="flex items-center gap-2 border border-border rounded-md px-3 py-2 bg-muted/40">
                  <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1">{email}</span>
                </div>
                <input type="hidden" name="email" value={email} />
                <p className="text-xs text-muted-foreground">
                  E-mail vinculado à sua compra — não pode ser alterado.
                </p>
              </div>

              {/* WhatsApp */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-[#6699F3]" />
                  WhatsApp
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  autoComplete="tel"
                  defaultValue={defaultPhone ?? ""}
                  required
                  disabled={isPending}
                  aria-invalid={!!fe.phone}
                />
                {defaultPhone && !fe.phone && (
                  <p className="text-xs text-[#6699F3]">
                    Preenchido automaticamente com o número da sua compra.
                  </p>
                )}
                <FieldError msg={fe.phone} />
              </div>

              {/* CPF */}
              <div className="space-y-2">
                <Label htmlFor="cpf" className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-[#6699F3]" />
                  CPF
                </Label>
                <Input
                  id="cpf"
                  name="cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={14}
                  defaultValue={defaultCpf ?? ""}
                  required
                  disabled={isPending}
                  aria-invalid={!!fe.cpf}
                />
                {defaultCpf && !fe.cpf && (
                  <p className="text-xs text-[#6699F3]">
                    Preenchido automaticamente com o CPF da sua compra.
                  </p>
                )}
                <FieldError msg={fe.cpf} />
              </div>

              {/* Data de nascimento */}
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

              {/* Senha */}
              <div className="space-y-2">
                <Label htmlFor="password">Criar senha</Label>
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

              {/* Confirmar senha */}
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
          )}
        </CardContent>

        {!state?.success && (
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Criando conta…" : "Criar minha conta"}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Já tem conta?{" "}
              <Link href="/login" className="text-foreground font-medium underline-offset-4 hover:underline">
                Entrar
              </Link>
            </p>
          </CardFooter>
        )}

        {state?.success && (
          <CardFooter>
            <p className="text-sm text-center text-muted-foreground w-full">
              <Link href="/login" className="text-foreground font-medium underline-offset-4 hover:underline">
                Ir para o login
              </Link>
            </p>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
