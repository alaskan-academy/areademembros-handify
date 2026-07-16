"use client";

import { useState } from "react";
import { X, Bookmark } from "lucide-react";

const URL_NOVA_AREA = "https://membros.handify.com.br";

export default function MigradaBanner() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="bg-[#6699F3] text-white px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <Bookmark className="w-5 h-5 shrink-0 opacity-80" />
        <p className="flex-1 text-sm font-medium leading-snug">
          <span className="font-bold">Salve o link da sua nova área de membros:</span>{" "}
          <span className="underline underline-offset-2 font-mono">{URL_NOVA_AREA}</span>
          {" — "}
          adicione aos favoritos do navegador para entrar facilmente da próxima vez.
        </p>
        <button
          onClick={() => setVisible(false)}
          aria-label="Fechar aviso"
          className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
