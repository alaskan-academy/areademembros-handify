"use client";

import { useState, useRef, useTransition } from "react";
import Image from "next/image";
import { Plus, X, Edit2, Trash2, Pin, PinOff, Eye, EyeOff, Loader2, Upload, ImageIcon, MessageCircle, ChevronDown, ChevronUp, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  createNewsPost, updateNewsPost, deleteNewsPost,
  toggleNewsPublished, toggleNewsPinned, uploadCommunityImage,
  getNewsCommentsAdmin, deleteNewsCommentAdmin,
} from "./actions";
import type { AdminFeedComment } from "./actions";

export type AdminNewsPost = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  pinned: boolean;
  published: boolean;
  created_at: string;
  author: { full_name: string } | null;
  comment_count: number;
};

interface Props {
  posts: AdminNewsPost[];
}

const EMPTY_FORM = { title: "", body: "", image_url: "", published: true, pinned: false };

export default function FeedAdminClient({ posts: initialPosts }: Props) {
  const [posts, setPosts] = useState<AdminNewsPost[]>(initialPosts);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  // Comentários por post
  const [commentsOpen, setCommentsOpen] = useState<Record<string, boolean>>({});
  const [commentsData, setCommentsData] = useState<Record<string, AdminFeedComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});

  async function handleToggleComments(postId: string) {
    const nowOpen = !commentsOpen[postId];
    setCommentsOpen((prev) => ({ ...prev, [postId]: nowOpen }));
    if (nowOpen && !commentsData[postId]) {
      setCommentsLoading((prev) => ({ ...prev, [postId]: true }));
      const data = await getNewsCommentsAdmin(postId);
      setCommentsData((prev) => ({ ...prev, [postId]: data }));
      setCommentsLoading((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function handleDeleteComment(postId: string, commentId: string) {
    if (!confirm("Deletar este comentário?")) return;
    const result = await deleteNewsCommentAdmin(commentId);
    if (result.error) return;
    setCommentsData((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? []).filter((c) => c.id !== commentId),
    }));
    setPosts((prev) => prev.map((p) =>
      p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p
    ));
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(post: AdminNewsPost) {
    setEditingId(post.id);
    setForm({
      title: post.title,
      body: post.body,
      image_url: post.image_url ?? "",
      published: post.published,
      pinned: post.pinned,
    });
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadCommunityImage(fd);
    setUploading(false);
    if (result.error) { setError(result.error); return; }
    setForm((f) => ({ ...f, image_url: result.url ?? "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("body", form.body);
    fd.append("image_url", form.image_url);
    fd.append("published", String(form.published));
    fd.append("pinned", String(form.pinned));

    const result = editingId
      ? await updateNewsPost(editingId, fd)
      : await createNewsPost(fd);

    setSubmitting(false);
    if (result.error) { setError(result.error); return; }

    // Reload to get fresh server data
    window.location.reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("Deletar este post permanentemente?")) return;
    const result = await deleteNewsPost(id);
    if (!result.error) setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  function handleTogglePublished(id: string, current: boolean) {
    startTransition(async () => {
      await toggleNewsPublished(id, !current);
      setPosts((prev) => prev.map((p) => p.id === id ? { ...p, published: !current } : p));
    });
  }

  function handleTogglePinned(id: string, current: boolean) {
    startTransition(async () => {
      await toggleNewsPinned(id, !current);
      setPosts((prev) => prev.map((p) => p.id === id ? { ...p, pinned: !current } : p));
    });
  }

  return (
    <div className="space-y-6">
      {/* Botão criar */}
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6699F3] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Novo post
        </button>
      </div>

      {/* Formulário inline */}
      {showForm && (
        <div className="bg-white rounded-xl border border-[#6699F3]/30 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base">{editingId ? "Editar post" : "Criar novo post"}</h2>
            <button onClick={closeForm} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-foreground/70 mb-1">Título *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Título do post"
                required
                maxLength={200}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground/70 mb-1">Conteúdo</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Escreva o conteúdo do post…"
                rows={6}
                maxLength={10000}
                className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
              />
            </div>

            {/* Imagem */}
            <div>
              <label className="block text-xs font-medium text-foreground/70 mb-1">Imagem (opcional)</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://... ou faça upload →"
                  className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1.5 shrink-0"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload
                </button>
              </div>
              {form.image_url && (
                <div className="mt-2 relative rounded-lg overflow-hidden border border-border" style={{ height: 140 }}>
                  <Image src={form.image_url} alt="Preview" fill className="object-cover" unoptimized />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Toggles */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[#6699F3]"
                />
                <span className="text-sm font-medium">Publicar agora</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[#6699F3]"
                />
                <span className="text-sm font-medium">Fixar no topo</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || !form.title.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#6699F3] text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? "Salvar" : "Publicar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de posts */}
      {posts.length === 0 && !showForm && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-medium">Nenhum post ainda</p>
          <p className="text-sm mt-1">Crie o primeiro aviso para as alunas.</p>
        </div>
      )}

      <div className="space-y-3">
        {posts.map((post) => (
          <div
            key={post.id}
            className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden"
          >
            <div className="flex gap-4 p-4">
              {/* Thumbnail */}
              {post.image_url ? (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0">
                  <Image src={post.image_url} alt={post.title} fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                </div>
              )}

              {/* Conteúdo */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 mb-1">
                  <h3 className="font-semibold text-sm text-foreground flex-1 line-clamp-1">{post.title}</h3>
                  <div className="flex items-center gap-1 shrink-0">
                    {post.pinned && (
                      <span className="text-[10px] font-semibold text-[#6699F3] bg-[#6699F3]/10 px-2 py-0.5 rounded-full">Fixado</span>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${post.published ? "text-[#72CF92] bg-[#72CF92]/10" : "text-muted-foreground bg-muted"}`}>
                      {post.published ? "Publicado" : "Rascunho"}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{post.body || "(sem texto)"}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">
                  {post.comment_count} {post.comment_count === 1 ? "comentário" : "comentários"} ·{" "}
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
            </div>

            {/* Barra de ações */}
            <div className="border-t border-border/40 px-4 py-2 flex items-center gap-1 flex-wrap">
              <button
                onClick={() => openEdit(post)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" /> Editar
              </button>

              <button
                onClick={() => handleTogglePublished(post.id, post.published)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  post.published
                    ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                    : "text-[#6699F3] bg-[#6699F3]/10 hover:bg-[#6699F3]/20"
                }`}
              >
                {post.published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {post.published ? "Despublicar" : "Publicar"}
              </button>

              <button
                onClick={() => handleTogglePinned(post.id, post.pinned)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  post.pinned
                    ? "text-[#FEC649] bg-[#FEC649]/10 hover:bg-[#FEC649]/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {post.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                {post.pinned ? "Desfixar" : "Fixar"}
              </button>

              {post.comment_count > 0 && (
                <button
                  onClick={() => handleToggleComments(post.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  {post.comment_count} {post.comment_count === 1 ? "comentário" : "comentários"}
                  {commentsOpen[post.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}

              <div className="flex-1" />

              <button
                onClick={() => handleDelete(post.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            </div>

            {/* Seção de comentários expandível */}
            {commentsOpen[post.id] && (
              <div className="border-t border-border/40 bg-muted/30 px-4 py-3 space-y-2">
                {commentsLoading[post.id] ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (commentsData[post.id] ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum comentário.</p>
                ) : (
                  (commentsData[post.id] ?? []).map((comment) => (
                    <div key={comment.id} className="flex items-start gap-2.5 bg-white rounded-lg border border-border/40 px-3 py-2">
                      <div className="w-7 h-7 rounded-full bg-[#6699F3]/15 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-[#6699F3]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-xs font-semibold">
                            {comment.profiles?.full_name || "Aluna"}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/80 mt-0.5 whitespace-pre-line">{comment.body}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteComment(post.id, comment.id)}
                        className="p-1 text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                        aria-label="Deletar comentário"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
