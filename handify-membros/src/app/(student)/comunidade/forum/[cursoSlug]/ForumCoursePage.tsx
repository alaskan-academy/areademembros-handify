"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Plus, X, ArrowLeft, Loader2 } from "lucide-react";
import ForumPostCard, { type ForumPostData } from "@/components/community/ForumPostCard";
import { createForumPost, deleteForumPost } from "@/app/(student)/comunidade/forum/actions";

interface Props {
  course: { id: string; slug: string; title: string };
  posts: ForumPostData[];
  userId: string;
  likedIds: string[];
}

export default function ForumCoursePage({ course, posts: initialPosts, userId, likedIds }: Props) {
  const [posts, setPosts] = useState<ForumPostData[]>(initialPosts);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const likedSet = new Set(likedIds);

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    fd.append("title", title);
    fd.append("body", body);

    const result = await createForumPost(course.id, course.slug, fd);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    // Reload — Next.js revalidatePath will update the server data
    window.location.reload();
  }

  async function handleDeletePost(postId: string) {
    if (!confirm("Deletar este post?")) return;
    await deleteForumPost(postId, course.slug);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/comunidade/forum"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Fóruns
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium text-foreground truncate">{course.title}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#6699F3]/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-[#6699F3]" />
          </div>
          <div>
            <h1 className="font-black text-xl text-foreground line-clamp-1">{course.title}</h1>
            <p className="text-sm text-muted-foreground">{posts.length} {posts.length === 1 ? "post" : "posts"}</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#6699F3] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancelar" : "Novo post"}
        </button>
      </div>

      {/* Formulário de novo post */}
      {showForm && (
        <form
          onSubmit={handleCreatePost}
          className="bg-white rounded-xl border border-[#6699F3]/30 shadow-sm p-5 mb-6 space-y-4"
        >
          <h2 className="font-bold text-sm text-foreground">Criar novo post</h2>
          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
          <div>
            <label className="block text-xs font-medium text-foreground/70 mb-1">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sobre o que é seu post?"
              required
              maxLength={200}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground/70 mb-1">Descrição</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Conte mais detalhes, faça sua pergunta, compartilhe seu projeto…"
              required
              rows={4}
              maxLength={5000}
              className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); }}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !body.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6699F3] text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Publicar
            </button>
          </div>
        </form>
      )}

      {/* Lista de posts */}
      {posts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum post ainda</p>
          <p className="text-sm mt-1">Seja a primeira a postar neste fórum!</p>
        </div>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => (
            <ForumPostCard
              key={post.id}
              post={post}
              userId={userId}
              initialLiked={likedSet.has(post.id)}
              onDelete={handleDeletePost}
            />
          ))}
        </div>
      )}
    </div>
  );
}
