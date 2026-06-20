import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import PerfilView from "./perfil-view";

export default function PerfilPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-[#6699F3]" />
        </div>
      }
    >
      <PerfilView />
    </Suspense>
  );
}
