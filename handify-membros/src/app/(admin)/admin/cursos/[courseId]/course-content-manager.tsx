"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Pencil, Trash2, Save, BookOpen, Video, FileText,
  Code, Link, Layers, GripVertical, Upload, Loader2, Archive, ArchiveRestore,
} from "lucide-react";
import {
  createModule, updateModule, deleteModule, toggleArchivedModule,
  createLesson, updateLesson, deleteLesson, toggleArchivedLesson,
  reorderModules, reorderLessons, uploadMaterialForLesson, deleteLessonMaterial,
  refreshLessonWithMaterials,
} from "./actions";
import type { LessonType, LessonData, LessonMaterial } from "./actions";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Lesson = LessonData;

interface Module {
  id: string; title: string; position: number; archived: boolean;
  lessons: Lesson[];
}

const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  video: "Vídeo", document: "Documento", html: "HTML",
  link: "Link externo", mixed: "Misto",
};
const LESSON_TYPE_ICONS: Record<LessonType, React.ElementType> = {
  video: Video, document: FileText, html: Code, link: Link, mixed: Layers,
};

// ─── Formulário de módulo ─────────────────────────────────────────────────────

function ModuleForm({ courseId, initial, onSave, onCancel, moduleId, nextPosition }: {
  courseId: string; initial?: Partial<Module>; onSave: (mod?: { id: string; title: string; position: number; archived: boolean }) => void;
  onCancel: () => void; moduleId?: string; nextPosition: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = moduleId
        ? await updateModule(moduleId, courseId, fd)
        : await createModule(courseId, fd);
      if (result.error) { setError(result.error); return; }
      const mod = "module" in result ? (result.module as { id: string; title: string; position: number; archived: boolean } | undefined) : undefined;
      onSave(mod);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 flex-wrap">
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
      <div className="flex-1 min-w-0 space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Título do módulo *</label>
        <input name="title" required defaultValue={initial?.title ?? ""}
          placeholder="Ex: Módulo 1 — Introdução"
          className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background" />
      </div>
      <input name="position" type="hidden" defaultValue={initial?.position ?? nextPosition} />
      <div className="flex gap-2">
        <button type="submit" disabled={isPending}
          className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50 font-medium">
          <Save className="w-3.5 h-3.5" />
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : moduleId ? "Salvar" : "Criar módulo"}
        </button>
        <button type="button" onClick={onCancel}
          className="text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Formulário de aula ───────────────────────────────────────────────────────

function LessonForm({ moduleId, courseId, initial, onSave, onCancel, lessonId, nextPosition }: {
  moduleId: string; courseId: string; initial?: Partial<Lesson>;
  onSave: (lesson?: Lesson) => void; onCancel: () => void;
  lessonId?: string; nextPosition: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lessonType, setLessonType] = useState<LessonType>(initial?.lesson_type ?? "video");
  const [titleValue, setTitleValue] = useState(initial?.title ?? "");
  const [existingMaterials, setExistingMaterials] = useState<LessonMaterial[]>(initial?.materials ?? []);
  const [newMaterials, setNewMaterials] = useState<{ name: string; file: File }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const contentFileRef = useRef<HTMLInputElement>(null);

  function handleAddMaterial(file: File) {
    setNewMaterials((prev) => [...prev, { name: file.name, file }]);
  }

  function handleDeleteExistingMaterial(material: LessonMaterial) {
    if (!confirm(`Excluir material "${material.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteLessonMaterial(material.id, material.file_path, courseId);
      if (result.error) { setError(result.error); return; }
      setExistingMaterials((prev) => prev.filter((m) => m.id !== material.id));
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!fd.get("is_preview")) fd.set("is_preview", "false");

    const contentFile = contentFileRef.current?.files?.[0];
    if (contentFile) fd.set("file", contentFile);

    startTransition(async () => {
      const result = lessonId
        ? await updateLesson(lessonId, courseId, fd)
        : await createLesson(moduleId, courseId, fd);

      if (result.error) { setError(result.error); return; }

      const savedLessonId = result.lesson?.id ?? lessonId;

      if (savedLessonId && newMaterials.length > 0) {
        const uploadErrors: string[] = [];
        await Promise.allSettled(
          newMaterials.map(async (m) => {
            const mfd = new FormData();
            mfd.set("file", m.file);
            mfd.set("name", m.name);
            const res = await uploadMaterialForLesson(savedLessonId, mfd);
            if (res.error) uploadErrors.push(`${m.name}: ${res.error}`);
          })
        );
        if (uploadErrors.length > 0) {
          setError(`Erro no upload de materiais: ${uploadErrors.join("; ")}`);
        }
      }

      // Busca o estado final do servidor após todos os uploads
      const finalLesson = savedLessonId
        ? (await refreshLessonWithMaterials(savedLessonId)) ?? result.lesson
        : result.lesson;
      onSave(finalLesson ?? undefined);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pl-4 border-l-2 border-[#6699F3]/20">
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">{error}</p>}

      {/* Tipo de aula */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Tipo de aula</label>
        <div className="flex gap-2 flex-wrap">
          {(["video", "document", "html", "link", "mixed"] as LessonType[]).map((t) => {
            const Icon = LESSON_TYPE_ICONS[t];
            return (
              <button
                key={t} type="button"
                onClick={() => setLessonType(t)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  lessonType === t
                    ? "bg-[#6699F3] text-white border-[#6699F3]"
                    : "border-border text-muted-foreground hover:border-[#6699F3] hover:text-[#6699F3]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {LESSON_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>
        <input name="lesson_type" type="hidden" value={lessonType} />
      </div>

      {/* Título e duração */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Título *</label>
          <input name="title" required
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            placeholder="Título da aula"
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Duração (segundos)</label>
          <input name="duration_seconds" type="number" min="0"
            defaultValue={initial?.duration_seconds ?? 0}
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background" />
        </div>
      </div>

      {/* Conteúdo condicional por tipo */}
      {lessonType === "video" && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">ID do vídeo (Panda Video)</label>
          <input name="video_panda_id" defaultValue={initial?.video_panda_id ?? ""}
            placeholder="abc123xyz..."
            className="w-full text-sm border border-border rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background" />
        </div>
      )}

      {lessonType === "document" && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Arquivo principal <span className="text-muted-foreground/60">(PDF, DOC, PPT · max 50MB)</span>
          </label>
          <input ref={contentFileRef} type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
            className="w-full text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#6699F3]/10 file:text-[#6699F3] hover:file:bg-[#6699F3]/20 cursor-pointer" />
        </div>
      )}

      {lessonType === "html" && (
        lessonId ? (
          <p className="text-xs text-muted-foreground bg-muted/40 px-3 py-2.5 rounded-lg">
            Para editar o conteúdo HTML, use o editor de blocos.{" "}
            <a href={`/admin/cursos/${courseId}/aulas/${lessonId}`}
              className="text-[#6699F3] hover:underline font-medium">
              Abrir editor de blocos →
            </a>
          </p>
        ) : (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Conteúdo HTML inicial <span className="text-muted-foreground/60">(opcional — edite blocos detalhados após criar)</span>
            </label>
            <textarea name="html_content" rows={4} placeholder="<p>Conteúdo HTML...</p>"
              className="w-full text-xs font-mono border border-border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background" />
          </div>
        )
      )}

      {lessonType === "link" && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">URL do conteúdo</label>
          <input name="link_url" type="url" defaultValue=""
            placeholder="https://..."
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background" />
        </div>
      )}

      {/* Descrição */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Descrição <span className="text-muted-foreground/60">(texto, links, títulos)</span>
        </label>
        <textarea name="description" rows={3} defaultValue={initial?.description ?? ""}
          placeholder="Descreva o que a aluna vai aprender nessa aula..."
          className="w-full text-sm border border-border rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40 bg-background" />
      </div>

      {/* Materiais complementares */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Materiais complementares
        </label>

        {/* Materiais já salvos */}
        {existingMaterials.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Salvos:</p>
            {existingMaterials.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs bg-muted/50 px-3 py-1.5 rounded-lg">
                <span className="truncate text-foreground">{m.name}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteExistingMaterial(m)}
                  disabled={isPending}
                  className="text-red-500 hover:text-red-600 ml-2 shrink-0 disabled:opacity-50 font-bold"
                >×</button>
              </div>
            ))}
          </div>
        )}

        {/* Novos materiais para upload */}
        <input ref={fileRef} type="file" multiple className="hidden"
          onChange={(e) => {
            Array.from(e.target.files ?? []).forEach(handleAddMaterial);
            e.target.value = "";
          }} />
        <button type="button" onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dashed border-border hover:border-[#6699F3] text-muted-foreground hover:text-[#6699F3] transition-colors">
          <Upload className="w-3.5 h-3.5" /> Adicionar material
        </button>
        {newMaterials.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Para upload:</p>
            {newMaterials.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-[#6699F3]/5 px-3 py-1.5 rounded-lg border border-[#6699F3]/20">
                <span className="truncate">{m.name}</span>
                <button type="button" onClick={() => setNewMaterials((prev) => prev.filter((_, j) => j !== i))}
                  className="text-red-500 hover:text-red-600 ml-2 shrink-0 font-bold">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <input name="position" type="hidden" defaultValue={initial?.position ?? nextPosition} />
      <label className="flex items-center gap-2 cursor-pointer">
        <input name="is_preview" type="checkbox" value="true"
          defaultChecked={initial?.is_preview ?? false} className="rounded" />
        <span className="text-sm">Prévia gratuita (sem matrícula)</span>
      </label>

      <div className="flex gap-2">
        <button type="submit" disabled={isPending}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50 font-medium">
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {isPending ? "Salvando..." : lessonId ? "Salvar aula" : "Criar aula"}
        </button>
        <button type="button" onClick={onCancel}
          className="text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Item sortável de aula ────────────────────────────────────────────────────

function SortableLesson({ lesson: initialLesson, courseId, moduleId, editingLessonId, setEditingLessonId, onDelete, isPending }: {
  lesson: Lesson; courseId: string; moduleId: string;
  editingLessonId: string | null; setEditingLessonId: (id: string | null) => void;
  onDelete: (id: string, title: string) => void; isPending: boolean;
}) {
  const [lesson, setLesson] = useState(initialLesson);
  const [archivePending, startArchiveTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lesson.id });

  const Icon = LESSON_TYPE_ICONS[lesson.lesson_type] ?? Video;

  function handleToggleArchive() {
    const next = !lesson.archived;
    startArchiveTransition(async () => {
      const result = await toggleArchivedLesson(lesson.id, courseId, next);
      if (!result.error) setLesson((prev) => ({ ...prev, archived: next }));
    });
  }

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      {editingLessonId === lesson.id ? (
        <div className="px-4 py-4">
          <LessonForm
            moduleId={moduleId} courseId={courseId} lessonId={lesson.id} initial={lesson}
            nextPosition={lesson.position}
            onSave={(updated) => {
              if (updated) setLesson(updated);
              setEditingLessonId(null);
            }}
            onCancel={() => setEditingLessonId(null)}
          />
        </div>
      ) : (
        <div className={`flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors gap-2 border-b border-border/40 last:border-0 ${lesson.archived ? "opacity-50" : ""}`}>
          <div className="flex items-center gap-2 min-w-0">
            <button {...attributes} {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted transition-colors shrink-0 touch-none">
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40" />
            </button>
            <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className={`text-sm truncate ${lesson.archived ? "line-through text-muted-foreground" : ""}`}>
                {lesson.title}
              </p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                  {LESSON_TYPE_LABELS[lesson.lesson_type]}
                </span>
                {lesson.is_preview && <span className="text-[#72CF92]">Prévia</span>}
                {lesson.archived && <span className="text-orange-500">Arquivada</span>}
                {lesson.materials.length > 0 && (
                  <span className="text-muted-foreground/70">{lesson.materials.length} material(is)</span>
                )}
                {lesson.duration_seconds ? ` · ${Math.floor(lesson.duration_seconds / 60)}min` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setEditingLessonId(lesson.id)}
              className="p-1.5 rounded hover:bg-muted transition-colors" title="Editar">
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button onClick={handleToggleArchive} disabled={archivePending || isPending}
              className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
              title={lesson.archived ? "Desarquivar" : "Arquivar"}>
              {lesson.archived
                ? <ArchiveRestore className="w-3.5 h-3.5 text-orange-500" />
                : <Archive className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            <a href={`/admin/cursos/${courseId}/aulas/${lesson.id}`}
              className="text-[11px] text-[#6699F3] hover:underline px-1">
              Blocos →
            </a>
            <button onClick={() => onDelete(lesson.id, lesson.title)} disabled={isPending}
              className="p-1.5 rounded hover:bg-red-50 transition-colors disabled:opacity-50" title="Excluir">
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Item sortável de módulo ──────────────────────────────────────────────────

function SortableModule({ mod, courseId, editingModuleId, setEditingModuleId,
  addingLessonToModule, setAddingLessonToModule, editingLessonId, setEditingLessonId,
  onDeleteModule, onSave, isPending,
}: {
  mod: Module; courseId: string;
  editingModuleId: string | null; setEditingModuleId: (id: string | null) => void;
  addingLessonToModule: string | null; setAddingLessonToModule: (id: string | null) => void;
  editingLessonId: string | null; setEditingLessonId: (id: string | null) => void;
  onDeleteModule: (id: string, title: string) => void;
  onSave: () => void; isPending: boolean;
}) {
  const [archived, setArchived] = useState(mod.archived);
  const [archivePending, startArchiveTransition] = useTransition();
  const [, startDeleteLessonTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: mod.id });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [lessons, setLessons] = useState<Lesson[]>([...mod.lessons].sort((a, b) => a.position - b.position));
  const [, startReorder] = useTransition();

  function handleDeleteLessonLocal(lessonId: string, title: string) {
    if (!confirm(`Excluir aula "${title}"?`)) return;
    startDeleteLessonTransition(async () => {
      const result = await deleteLesson(lessonId, courseId);
      if (result.error) { alert(result.error); return; }
      setLessons((prev) => prev.filter((l) => l.id !== lessonId));
    });
  }

  function handleLessonDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = lessons.findIndex((l) => l.id === active.id);
    const newIdx = lessons.findIndex((l) => l.id === over.id);
    const reordered = arrayMove(lessons, oldIdx, newIdx).map((l, i) => ({ ...l, position: i + 1 }));
    setLessons(reordered);
    startReorder(async () => {
      await reorderLessons(reordered.map(({ id, position }) => ({ id, position })));
    });
  }

  function handleToggleArchive() {
    const next = !archived;
    startArchiveTransition(async () => {
      const result = await toggleArchivedModule(mod.id, courseId, next);
      if (!result.error) setArchived(next);
    });
  }

  const nextLessonPosition = lessons.length + 1;

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="handify-card overflow-hidden">
      {/* Cabeçalho */}
      <div className={`px-4 py-3 bg-muted/50 border-b border-border ${archived ? "opacity-60" : ""}`}>
        {editingModuleId === mod.id ? (
          <ModuleForm
            courseId={courseId} moduleId={mod.id} initial={{ ...mod, archived }} nextPosition={mod.position}
            onSave={() => { setEditingModuleId(null); onSave(); }}
            onCancel={() => setEditingModuleId(null)}
          />
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button {...attributes} {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted transition-colors touch-none">
                <GripVertical className="w-4 h-4 text-muted-foreground/40" />
              </button>
              <div className="min-w-0">
                <p className={`font-semibold text-sm ${archived ? "line-through text-muted-foreground" : ""}`}>
                  {mod.title}
                </p>
                {archived && <span className="text-[10px] text-orange-500 font-medium">Arquivado</span>}
              </div>
              <span className="text-xs text-muted-foreground">({lessons.length} aulas)</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setEditingModuleId(mod.id)}
                className="p-1.5 rounded hover:bg-muted transition-colors" title="Editar">
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button onClick={handleToggleArchive} disabled={archivePending || isPending}
                className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
                title={archived ? "Desarquivar" : "Arquivar"}>
                {archived
                  ? <ArchiveRestore className="w-3.5 h-3.5 text-orange-500" />
                  : <Archive className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
              <button onClick={() => onDeleteModule(mod.id, mod.title)} disabled={isPending}
                className="p-1.5 rounded hover:bg-red-50 transition-colors disabled:opacity-50" title="Excluir">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Aulas sortáveis */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLessonDragEnd}>
        <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {lessons.map((lesson) => (
            <SortableLesson
              key={lesson.id} lesson={lesson} courseId={courseId} moduleId={mod.id}
              editingLessonId={editingLessonId} setEditingLessonId={setEditingLessonId}
              onDelete={handleDeleteLessonLocal} isPending={isPending}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Formulário nova aula */}
      {addingLessonToModule === mod.id && (
        <div className="px-4 py-4 border-t border-border/40">
          <LessonForm
            moduleId={mod.id} courseId={courseId} nextPosition={nextLessonPosition}
            onSave={(lesson) => {
              if (lesson) setLessons((prev) => [...prev, lesson]);
              setAddingLessonToModule(null);
              onSave();
            }}
            onCancel={() => setAddingLessonToModule(null)}
          />
        </div>
      )}

      <div className="px-4 py-2 border-t border-border/30">
        <button
          onClick={() => { setAddingLessonToModule(mod.id); setEditingLessonId(null); }}
          className="flex items-center gap-1 text-xs text-[#6699F3] hover:underline">
          <Plus className="w-3 h-3" /> Nova aula
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CourseContentManager({ courseId, initialModules }: {
  courseId: string; initialModules: Module[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modules, setModules] = useState<Module[]>([...initialModules].sort((a, b) => a.position - b.position));
  const [addingModule, setAddingModule] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [addingLessonToModule, setAddingLessonToModule] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function refresh() { router.refresh(); }

  function handleModuleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = modules.findIndex((m) => m.id === active.id);
    const newIdx = modules.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(modules, oldIdx, newIdx).map((m, i) => ({ ...m, position: i + 1 }));
    setModules(reordered);
    startTransition(async () => {
      await reorderModules(reordered.map(({ id, position }) => ({ id, position })));
    });
  }

  function handleDeleteModule(moduleId: string, title: string) {
    if (!confirm(`Excluir módulo "${title}"? Todas as aulas serão excluídas.`)) return;
    startTransition(async () => {
      const result = await deleteModule(moduleId, courseId);
      if (result.error) alert(result.error);
      else setModules((prev) => prev.filter((m) => m.id !== moduleId));
    });
  }

  const nextModulePosition = modules.length + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#6699F3]" />
          Módulos e Aulas
        </h2>
        <button onClick={() => { setAddingModule(true); setEditingModuleId(null); }}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-[#6699F3] text-[#6699F3] hover:bg-[#6699F3]/10 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Novo módulo
        </button>
      </div>

      {addingModule && (
        <div className="handify-card p-4">
          <ModuleForm
            courseId={courseId} nextPosition={nextModulePosition}
            onSave={(mod) => {
              if (mod) setModules((prev) => [...prev, { ...mod, lessons: [] }]);
              setAddingModule(false);
            }}
            onCancel={() => setAddingModule(false)}
          />
        </div>
      )}

      {modules.length === 0 && !addingModule && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum módulo ainda. Clique em "Novo módulo" para começar.
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
        <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {modules.map((mod) => (
              <SortableModule
                key={mod.id} mod={mod} courseId={courseId}
                editingModuleId={editingModuleId} setEditingModuleId={setEditingModuleId}
                addingLessonToModule={addingLessonToModule} setAddingLessonToModule={setAddingLessonToModule}
                editingLessonId={editingLessonId} setEditingLessonId={setEditingLessonId}
                onDeleteModule={handleDeleteModule}
                onSave={refresh} isPending={isPending}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
