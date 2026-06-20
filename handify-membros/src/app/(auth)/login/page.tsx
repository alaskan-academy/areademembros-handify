"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "../actions";
import { Button } from "@/components/ui/button";
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

const initialState = { error: undefined, success: undefined };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; msg?: string }>;
}) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Entrar</CardTitle>
        <CardDescription>
          Acesse sua conta para continuar aprendendo
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link
                href="/recuperar-senha"
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={isPending}
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Entrando…" : "Entrar"}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            Não tem conta?{" "}
            <Link
              href="/cadastro"
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              Criar conta
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
