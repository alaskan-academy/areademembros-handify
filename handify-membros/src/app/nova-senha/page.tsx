"use client";

import { useActionState } from "react";
import { novaSenhaAction } from "@/app/(auth)/actions";
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

export default function NovaSenhaPage() {
  const [state, formAction, isPending] = useActionState(novaSenhaAction, initialState);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <span className="text-2xl font-bold tracking-tight text-foreground">
            Handify
          </span>
        </div>

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

              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  required
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirmar nova senha</Label>
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
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
      </div>
    </div>
  );
}
