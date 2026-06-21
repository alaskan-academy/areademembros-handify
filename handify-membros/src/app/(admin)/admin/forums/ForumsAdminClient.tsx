"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, X, Check, MessageSquare, BookOpen } from "lucide-react";
import { createForum, updateForum, deleteForum } from "./actions";

type ForumRow = { id: string; title: string; slug: string; description: string | null; course_count: number };

interface Props { forums: ForumRow[] }

export default function ForumsAdminClient({ forums: initial }: Props) {
  const [forums, setForums] = useState(initial);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleCreate() {
    if (!newTitle.trim()) return;
    startTransition(async () => {
      const result = await createForum(newTitle, newDesc);
      if (result.error) { setError(result.error); return; }
      setForums((prev) => [...prev, { id: result.id!, title: newTitle.trim(), slug: result.slug!, description: newDesc.trim() || null, course_count: 0 }].sort((a,b) => a.title.localeCompare(b.title)));
      setNewTitle(""); setNewDesc(""); setShowCreate(false); setError(null);
    });
  }

  function startEdit(f: ForumRow) {
    setEditingId(f.id); setEditTitle(f.title); setEditDesc(f.description ?? "");
  }

  function handleUpdate(id: string) {
    if (!editTitle.trim()) return;
    startTransition(async () => {
      const result = await updateForum(id, editTitle, editDesc);
      if (result.error) { setError(result.error); return; }
      setForums((prev) => prev.map((f) => f.id === id ? { ...f, title: editTitle.trim(), description: editDesc.trim() || null } : f));
      setEditingId(null); setError(null);
    });
  }

  function handleDelete(id: string, title: string) {
    if (!confirm(`Excluir o fórum "${title}"? Os posts do fórum serão perdidos.`)) return;
    startTransition(async () => {
      const result = await deleteForum(id);
      if (result.error) { setError(result.error); return; }
      setForums((prev) => prev.filter((f) => f.id !== id));
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6699F3]/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-[#6699F3]" />
          </div>
          <div>
            <h1 className="font-black text-xl">Fóruns</h1>
            <p className="text-sm text-muted-foreground">{forums.length} fórum{forums.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors font-medium"
        >
          <Plus className="w-4 h-4" /> Novo fórum
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* Formulário de criação */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-[#6699F3]/30 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">Novo fórum</h2>
            <button onClick={() => { setShowCreate(false); setNewTitle(""); setNewDesc(""); setError(null); }}
              className="p-1 rounded hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ex: Fórum de Crochê"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição (opcional)</label>
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Sobre o que é este fórum..."
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={!newTitle.trim()}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50">
              <Plus className="w-4 h-4" /> Criar fórum
            </button>
            <button onClick={() => { setShowCreate(false); setNewTitle(""); setNewDesc(""); setError(null); }}
              className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {forums.length === 0 && !showCreate ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum fórum criado ainda</p>
          <p className="text-sm mt-1">Crie um fórum e vincule-o aos cursos em Admin → Cursos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {forums.map((forum) => (
            <div key={forum.id} className="bg-white rounded-xl border border-border/60 shadow-sm">
              {editingId === forum.id ? (
                <div className="p-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate(forum.id)}
                      className="w-full text-sm border border-[#6699F3] rounded-lg px-3 py-2 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
                    <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(forum.id)} disabled={!editTitle.trim()}
                      className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4] transition-colors disabled:opacity-50">
                      <Check className="w-3.5 h-3.5" /> Salvar
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 p-4">
                  <div className="w-9 h-9 rounded-lg bg-[#6699F3]/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-[#6699F3]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{forum.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">/comunidade/forum/{forum.slug}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <BookOpen className="w-3 h-3" /> {forum.course_count} curso{forum.course_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {forum.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{forum.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(forum)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors">
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDelete(forum.id, forum.title)}
                      className="p-2 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
