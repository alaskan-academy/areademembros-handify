import type { Metadata } from "next";
import FullPageMessage from "@/components/layout/FullPageMessage";

export const metadata: Metadata = {
  title: "Página não encontrada — Handify™",
};

export default function NotFound() {
  return (
    <FullPageMessage
      title="Não encontramos essa página"
      description="O link pode estar incompleto, ou a página pode ter mudado de lugar. Seus cursos continuam todos aí."
    />
  );
}
