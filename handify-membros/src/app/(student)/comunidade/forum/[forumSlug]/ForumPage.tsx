"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { MessageSquare, Plus, X, ArrowLeft, Loader2, ImageIcon, Paperclip } from "lucide-react";
import Image from "next/image";
import ForumPostCard, { type ForumPostData } from "@/components/community/ForumPostCard";
import { createForumPost, deleteForumPost, uploadForumFile } from "@/app/(student)/comunidade/forum/actions";

interface Props {
  forum: { id: string; slug: string; title: string; description: string | null };
  posts: ForumPostData[];
  userId: string;
  likedIds: string[];
}

export default function ForumPage({ forum, posts: initialPosts, userId, likedIds }: Props) {
  const [posts, setPosts] = useState<ForumPostData[]>(initialPosts);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const likedSet = new Set(likedIds);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, type: "image" | "file") {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("file_type", type);
    const result = await uploadForumFile(fd);
    setUploading(false);
    if (result.error) { setError(result.error); return; }
    if (type === "image") {
      setImageUrl(result.url ?? "");
    } else {
      setAttachmentUrl(result.url ?? "");
      setAttachmentName(result.name ?? file.name);
    }
    e.target.value = "";
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const fd = new FormData();
    fd.append("title", title);
    fd.append("body", body);
    fd.append("image_url", imageUrl);
    fd.append("attachment_url", attachmentUrl);
    fd.append("attachment_name", attachmentName);

    const result = await createForumPost(forum.id, forum.slug, fd);
    setSubmitting(false);

    if (result.error) { setError(result.error); return; }
    closeForm();
    alert("Post enviado! Aguarde a aprovação da equipe Handify para aparecer no fórum.");
  }

  function closeForm() {
    setShowForm(false);
    setTitle(""); setBody("");
    setImageUrl(""); setAttachmentUrl(""); setAttachmentName("");
    setError(null);
  }

  async function handleDeletePost(postId: string) {
    if (!confirm("Deletar este post?")) return;
    await deleteForumPost(postId, forum.slug);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/comunidade/forum" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Fóruns
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium text-foreground truncate">{forum.title}</span>
      </div>

      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#6699F3]/10 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5 text-[#6699F3]" />
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-xl text-foreground line-clamp-1">{forum.title}</h1>
            <p className="text-sm text-muted-foreground line-clamp-1">
              {forum.description ?? `${posts.filter(p => p.approved).length} posts`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-lg bg-[#6699F3] text-white text-sm font-semibold hover:opacity-90 transition-opacity shrink-0"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancelar" : "Novo post"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreatePost} className="bg-white rounded-xl border border-[#6699F3]/30 shadow-sm p-5 mb-6 space-y-4">
          <h2 className="font-bold text-sm">Criar novo post</h2>
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-foreground/70 mb-1">Título *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Sobre o que é seu post?" required maxLength={200}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30" />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground/70 mb-1">Descrição *</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="Compartilhe sua dúvida, projeto ou ideia…" required rows={4} maxLength={5000}
              className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30" />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground/70 mb-1">Imagem (opcional)</label>
            <input ref={imageInputRef} type="file" accept="image/*" onChange={(e) => handleUpload(e, "image")} className="hidden" />
            {imageUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-border" style={{ height: 140 }}>
                <Image src={imageUrl} alt="Preview" fill className="object-cover" unoptimized />
                <button type="button" onClick={() => setImageUrl("")}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-[#6699F3]/50 hover:text-[#6699F3] transition-colors">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                Adicionar imagem
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground/70 mb-1">Arquivo (opcional — PDF, ZIP…)</label>
            <input ref={fileInputRef} type="file" onChange={(e) => handleUpload(e, "file")} className="hidden" />
            {attachmentUrl ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/40 text-sm">
                <Paperclip className="w-4 h-4 text-[#6699F3] shrink-0" />
                <span className="flex-1 truncate text-foreground/80">{attachmentName}</span>
                <button type="button" onClick={() => { setAttachmentUrl(""); setAttachmentName(""); }}
                  className="text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-[#6699F3]/50 hover:text-[#6699F3] transition-colors">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                Anexar arquivo
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">Seu post será revisado pela equipe antes de aparecer no fórum.</p>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={closeForm} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={submitting || uploading || !title.trim() || !body.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6699F3] text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Enviar para aprovação
            </button>
          </div>
        </form>
      )}

      {posts.filter(p => p.approved || p.user_id === userId).length === 0 ? (
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
