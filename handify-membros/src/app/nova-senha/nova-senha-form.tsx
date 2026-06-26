"use client";

import { useActionState } from "react";
import { novaSenhaAction } from "@/app/(auth)/actions";
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

const initialState = { error: undefined, success: undefined };

export default function NovaSenhaForm({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState(novaSenhaAction, initialState);

  if (state?.success) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Senha atualizada!</CardTitle>
          <CardDescription>
            Sua nova senha foi salva com sucesso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="status"
            className="rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-700"
          >
            Você já pode usar sua nova senha para entrar.
          </div>
        </CardContent>
        <CardFooter>
          <a
            href="/dashboard"
            className="w-full inline-flex items-center justify-center rounded-md bg-[#6699F3] text-white font-semibold px-4 py-2 text-sm hover:bg-[#5580d4] transition-colors"
          >
            Ir para o dashboard
          </a>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Nova senha</CardTitle>
        <CardDescription>
          Escolha uma senha segura de ao menos 8 caracteres
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

          {/* E-mail exibido (read-only) para confirmar à aluna qual conta está sendo alterada */}
          <div className="space-y-2">
            <Label htmlFor="email">E-mail da conta</Label>
            <Input
              id="email"
              type="email"
              value={email}
              readOnly
              disabled
              className="bg-muted text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
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
            <Label htmlFor="confirm_password">Confirmar nova senha</Label>
            <PasswordInput
              id="confirm_password"
              name="confirm_password"
              placeholder="••••••••"
              autoComplete="new-password"
              required
              disabled={isPending}
            />
          </div>
        </CardContent>

        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Salvando…" : "Salvar nova senha"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
