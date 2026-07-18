"use client";

import { Suspense } from "react";
import { useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "../actions";
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

const MSG_BANNERS: Record<string, string> = {
  "acesso-liberado": "Seu acesso foi liberado! Faça login para entrar nos seus cursos.",
  "ja-tem-conta": "Você já tem uma conta. Faça login normalmente.",
};

export default function LoginPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ redirect?: string; msg?: string }>;
}) {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const msgParam = searchParams.get("msg") ?? (searchParams.get("email") ? "ja-tem-conta" : null);
  const msgBanner = msgParam ? (MSG_BANNERS[msgParam] ?? null) : null;

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
          {msgBanner && (
            <div
              role="status"
              className="rounded-md bg-[#72CF92]/15 border border-[#72CF92]/30 px-4 py-3 text-sm text-[#2D2D2D]"
            >
              {msgBanner}
            </div>
          )}

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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                className="text-xs text-[#888] hover:text-[#2D2D2D] underline-offset-4 hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>
            <PasswordInput
              id="password"
              name="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={isPending}
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 bg-white border-t-0 rounded-b-xl">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Entrando…" : "Entrar"}
          </Button>

          <p className="text-sm text-center text-[#888]">
            Não tem conta?{" "}
            <Link
              href="/cadastro"
              className="text-[#2D2D2D] font-medium underline-offset-4 hover:underline"
            >
              Criar conta
            </Link>
          </p>

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
