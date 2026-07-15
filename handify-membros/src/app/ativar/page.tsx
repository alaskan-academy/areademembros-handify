"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { checkAtivarEmailAction } from "./actions";
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

const initialState = { error: undefined };

const ERRO_MSGS: Record<string, string> = {
  "token-invalido": "Link inválido. Digite seu e-mail novamente para receber um novo link.",
  "token-expirado": "Seu link expirou (válido por 30 minutos). Digite seu e-mail novamente.",
};

export default function AtivarPage() {
  const [state, formAction, isPending] = useActionState(
    checkAtivarEmailAction,
    initialState
  );
  const searchParams = useSearchParams();
  const erroParam = searchParams.get("erro");
  const erroMsg = erroParam ? (ERRO_MSGS[erroParam] ?? "Ocorreu um erro. Tente novamente.") : null;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Ativar meu acesso</CardTitle>
        <CardDescription className="text-foreground/80 text-sm leading-relaxed">
          <span className="font-semibold text-[#6699F3]">
            Temos uma área de membros nova para você!
          </span>{" "}
          Digite o e-mail que usou na compra dos seus cursos para ativar seu acesso.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4">
          {(state?.error || erroMsg) && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
            >
              {state?.error ?? erroMsg}
            </div>
          )}

          <div className="rounded-md bg-[#6699F3]/8 border border-[#6699F3]/20 px-4 py-3 text-sm text-[#2D2D2D] leading-relaxed">
            <strong className="text-[#6699F3]">Importante:</strong> use o mesmo e-mail que você usou
            quando comprou seu curso. Esse é o e-mail que vai identificar seu acesso.
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail da compra</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="voce@email.com"
              autoComplete="email"
              autoFocus
              required
              disabled={isPending}
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 bg-white border-t-0 rounded-b-xl">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Verificando…" : "Continuar"}
          </Button>

          <p className="text-sm text-center text-[#888]">
            Já tem conta na nova área?{" "}
            <a
              href="/login"
              className="text-[#2D2D2D] font-medium underline-offset-4 hover:underline"
            >
              Entrar
            </a>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
