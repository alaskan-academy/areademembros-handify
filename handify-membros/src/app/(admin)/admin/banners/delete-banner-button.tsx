"use client";

import { useTransition } from "react";
import { deleteBannerAction } from "./actions";

export default function DeleteBannerButton({ bannerId }: { bannerId: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Excluir este banner? Esta ação não pode ser desfeita.")) return;
    startTransition(async () => {
      const fd = new FormData();
      await deleteBannerAction(bannerId, fd);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="text-sm text-red-500 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      {pending ? "Excluindo…" : "Excluir"}
    </button>
  );
}
