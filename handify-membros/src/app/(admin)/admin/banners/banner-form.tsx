"use client";

import { useActionState, useState } from "react";
import { Upload, X } from "lucide-react";

export type BannerRow = {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  product_codes: string[];
  position_slot: string;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
};

export type CourseOption = {
  id: string;
  title: string;
  product_code: string | null;
};

type State = { error?: string; success?: string };

interface Props {
  action: (prev: State, formData: FormData) => Promise<State>;
  banner?: BannerRow;
  courses: CourseOption[];
  submitLabel: string;
}

const SLOT_LABELS: Record<string, string> = {
  header: "Header — topo da página de Cursos",
  lateral: "Lateral — sidebar da página de Aulas",
  "pos-aula": "Pós-aula — abaixo do vídeo na página de Aulas",
};

const SLOT_DIMS: Record<string, string> = {
  header: "1200 × 200 px",
  lateral: "280 × 280 px",
  "pos-aula": "900 × 200 px",
};

export default function BannerForm({ action, banner, courses, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [preview, setPreview] = useState<string | null>(banner?.image_url ?? null);
  const [slot, setSlot] = useState(banner?.position_slot ?? "header");

  const coursesWithCode = courses.filter((c) => c.product_code);

  const toDateInput = (iso: string | null | undefined) => iso?.slice(0, 10) ?? "";

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setPreview(null);
    const input = document.querySelector<HTMLInputElement>('input[name="image_file"]');
    if (input) input.value = "";
  }

  return (
    <form action={formAction} className="handify-card p-6 space-y-5" encType="multipart/form-data">
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          {state.success}
        </div>
      )}

      {/* Título */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Título (interno) *</label>
        <input
          name="title"
          required
          defaultValue={banner?.title}
          placeholder="Ex: Banner — Curso de Macramê"
          className="w-full text-sm px-3 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
        />
      </div>

      {/* Upload de imagem */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Imagem do banner *</label>

        {/* Campo oculto para preservar URL existente se não trocar a imagem */}
        {banner?.image_url && (
          <input type="hidden" name="existing_image_url" value={preview === banner.image_url ? banner.image_url : ""} />
        )}

        {preview ? (
          <div className="relative rounded-xl overflow-hidden bg-muted mb-3 border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview do banner"
              className="w-full object-cover max-h-48"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              title="Remover imagem"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label
            htmlFor="image_file_input"
            className="flex flex-col items-center justify-center gap-3 w-full h-36 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-[#6699F3] hover:bg-[#6699F3]/5 transition-colors mb-3"
          >
            <Upload className="w-7 h-7 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground/70">
                Clique para selecionar a imagem
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                JPEG, PNG ou WebP · Máx. 5 MB
              </p>
            </div>
          </label>
        )}

        <input
          id="image_file_input"
          name="image_file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFile}
          className="sr-only"
        />

        {preview && (
          <button
            type="button"
            onClick={() => document.getElementById("image_file_input")?.click()}
            className="text-xs text-[#6699F3] hover:underline"
          >
            Trocar imagem
          </button>
        )}

        <p className="text-xs text-muted-foreground mt-1">
          Dimensão recomendada para <strong>{SLOT_DIMS[slot] ?? "este slot"}</strong>
        </p>
      </div>

      {/* URL de destino */}
      <div>
        <label className="block text-sm font-medium mb-1.5">URL de destino *</label>
        <input
          name="link_url"
          type="url"
          required
          defaultValue={banner?.link_url}
          placeholder="https://..."
          className="w-full text-sm px-3 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
        />
      </div>

      {/* Slot */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Posição *</label>
        <select
          name="position_slot"
          required
          defaultValue={banner?.position_slot ?? "header"}
          onChange={(e) => setSlot(e.target.value)}
          className="w-full text-sm px-3 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
        >
          {Object.entries(SLOT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Cursos associados */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Ocultar para quem já tem estes cursos
        </label>
        <p className="text-xs text-muted-foreground mb-2">
          Deixe em branco para exibir a todos. Marque os cursos que o banner anuncia — quem já comprou não verá o banner.
        </p>
        {coursesWithCode.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Nenhum curso com product_code cadastrado.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto border border-border rounded-lg p-3 bg-white">
            {coursesWithCode.map((c) => (
              <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  name="product_codes"
                  value={c.product_code!}
                  defaultChecked={banner?.product_codes.includes(c.product_code!)}
                  className="accent-[#6699F3] w-4 h-4 shrink-0"
                />
                <span className="flex-1 truncate">{c.title}</span>
                <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                  {c.product_code}
                </code>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Vigência */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Início (opcional)</label>
          <input
            name="starts_at"
            type="date"
            defaultValue={toDateInput(banner?.starts_at)}
            className="w-full text-sm px-3 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Fim (opcional)</label>
          <input
            name="ends_at"
            type="date"
            defaultValue={toDateInput(banner?.ends_at)}
            className="w-full text-sm px-3 py-2.5 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
          />
        </div>
      </div>

      {/* Ativo */}
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          name="active"
          value="true"
          defaultChecked={banner?.active ?? true}
          className="accent-[#6699F3] w-4 h-4"
        />
        <span className="text-sm font-medium">Banner ativo</span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-[#6699F3] hover:bg-[#5580d4] transition-colors disabled:opacity-50"
      >
        {pending ? "Salvando…" : submitLabel}
      </button>
    </form>
  );
}
