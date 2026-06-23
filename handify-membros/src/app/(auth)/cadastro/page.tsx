"use client";

import { useActionState } from "react";
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

const initialState = { error: undefined, success: undefined };

export default function CadastroPage() {
  const [state, formAction, isPending] = useActionState(cadastroAction, initialState);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Criar conta</CardTitle>
        <CardDescription>
          Preencha seus dados para começar
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

          {state?.success && (
            <div
              role="status"
              className="rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-700 dark:text-green-400"
            >
              {state.success}
            </div>
          )}

          {!state?.success && (
            <>
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome completo</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  type="text"
                  placeholder="Maria Silva"
                  autoComplete="name"
                  required
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="voce@email.com"
                  autoComplete="email"
                  required
                  disabled={isPending}
                />
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
                  placeholder="(11) 99999-9999"
                  autoComplete="tel"
                  required
                  disabled={isPending}
                />
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
                  placeholder="000.000.000-00"
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={14}
                  required
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_of_birth" className="flex items-center gap-1.5">
                  <Cake className="w-4 h-4 text-[#6699F3]" />
                  Data de nascimento
                  <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
                </Label>
                <Input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                  max={new Date(new Date().setFullYear(new Date().getFullYear() - 10))
                    .toISOString()
                    .slice(0, 10)}
                  disabled={isPending}
                />
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
                />
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
                />
              </div>
            </>
          )}
        </CardContent>

        {!state?.success && (
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Criando conta…" : "Criar conta"}
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
        )}

        {state?.success && (
          <CardFooter>
            <p className="text-sm text-center text-muted-foreground w-full">
              <Link
                href="/login"
                className="text-foreground font-medium underline-offset-4 hover:underline"
              >
                Voltar para o login
              </Link>
            </p>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
