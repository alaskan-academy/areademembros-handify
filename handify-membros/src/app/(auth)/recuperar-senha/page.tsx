"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { recuperarSenhaAction } from "../actions";
import { createClient } from "@/lib/supabase/client";
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

export default function RecuperarSenhaPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = (formData.get("email") as string)?.trim();

    startTransition(async () => {
      // 1. Verifica server-side se o e-mail existe
      const result = await recuperarSenhaAction({}, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      // 2. Dispara o reset do lado do browser (garante PKCE code_verifier no browser)
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/nova-senha`,
      });

      if (resetError) {
        setError("Erro ao enviar e-mail. Tente novamente.");
        return;
      }

      setSuccess(true);
    });
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Recuperar senha</CardTitle>
        <CardDescription>
          Informe seu e-mail e enviaremos as instruções para redefinir sua senha
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-700 dark:text-green-400"
            >
              Instruções enviadas! Verifique sua caixa de entrada — se não encontrar, confira também a pasta de spam e lixeira.
            </div>
          )}

          {!success && (
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
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          {!success && (
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Enviando…" : "Enviar instruções"}
            </Button>
          )}

          <Link
            href="/login"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground text-center w-full"
          >
            Voltar para o login
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
