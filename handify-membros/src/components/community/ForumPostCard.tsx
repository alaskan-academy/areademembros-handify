"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Heart, MessageCircle, ChevronDown, ChevronUp, Trash2, Pin, Send, Loader2, Paperclip, Clock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { addForumComment, deleteForumComment, toggleForumLike } from "@/app/(student)/comunidade/forum/actions";

export type ForumComment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  profiles: { full_name: string; avatar_url: string | null; role: string } | null;
};

export type ForumPostData = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  pinned: boolean;
  approved: boolean;
  created_at: string;
  user_id: string;
  author: { full_name: string; avatar_url: string | null } | null;
  like_count: number;
  comment_count: number;
};

interface Props {
  post: ForumPostData;
  userId: string;
  initialLiked: boolean;
  onDelete?: (postId: string) => void;
}

function Avatar({ name, url, size = 8 }: { name: string; url?: string | null; size?: number }) {
  const initial = name?.charAt(0)?.toUpperCase() || "?";
  const cls = `w-${size} h-${size} rounded-full flex items-center justify-center font-bold text-white shrink-0`;
  if (url) return <Image src={url} alt={name} width={size * 4} height={size * 4} className={`${cls} object-cover`} />;
  return <div className={cls} style={{ background: "#6699F3", fontSize: size < 8 ? "0.65rem" : "0.875rem" }}>{initial}</div>;
}

export default function ForumPostCard({ post, userId, initialLiked, onDelete }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<ForumComment[] | null>(null);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();

  const isPending = !post.approved && post.user_id === userId;
  const bodyPreview = post.body.length > 300 && !expanded ? post.body.slice(0, 300) + "…" : post.body;

  async function loadComments() {
    if (comments !== null) return;
    setLoadingComments(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("forum_comments")
      .select("id, body, created_at, user_id, parent_id, profiles!user_id (full_name, avatar_url, role)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    setComments((data as unknown as ForumComment[]) ?? []);
    setLoadingComments(false);
  }

  function handleToggleComments() {
    if (!showComments && comments === null) loadComments();
    setShowComments((v) => !v);
  }

  function handleLike() {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => (wasLiked ? c - 1 : c + 1));
    startTransition(async () => { await toggleForumLike(post.id); });
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim() || submitting) return;
    setSubmitting(true);
    const result = await addForumComment(post.id, commentBody.trim());
    setSubmitting(false);
    if ("error" in result) return;
    setComments((prev) => [...(prev ?? []), result]);
    setCommentCount((c) => c + 1);
    setCommentBody("");
  }

  async function handleDeleteComment(commentId: string) {
    await deleteForumComment(commentId);
    setComments((prev) => (prev ?? []).filter((c) => c.id !== commentId));
    setCommentCount((c) => Math.max(0, c - 1));
  }

  const authorName = post.author?.full_name || "Aluna";
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR });
  const isOwner = post.user_id === userId;

  return (
    <article className={cn(
      "bg-white rounded-xl border shadow-sm overflow-hidden",
      isPending ? "border-[#FEC649]/40 bg-[#FEC649]/5" : "border-border/60"
    )}>
      {/* Banner pendente */}
      {isPending && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#FEC649]/10 border-b border-[#FEC649]/30 text-xs font-medium text-[#b8900d]">
          <Clock className="w-3.5 h-3.5" />
          Aguardando aprovação da equipe Handify
        </div>
      )}

      {/* Header do post */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start gap-3">
          <Avatar name={authorName} url={post.author?.avatar_url} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{authorName}</span>
              {post.pinned && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#6699F3] bg-[#6699F3]/10 px-2 py-0.5 rounded-full">
                  <Pin className="w-2.5 h-2.5" /> Fixado
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
          {isOwner && onDelete && (
            <button onClick={() => onDelete(post.id)}
              className="text-muted-foreground hover:text-red-500 transition-colors p-1" aria-label="Deletar post">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Imagem — acima do texto */}
      {post.image_url && (
        <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
          <Image src={post.image_url} alt={post.title} fill className="object-cover" unoptimized />
        </div>
      )}

      {/* Texto */}
      <div className="px-5 pt-3 pb-3">
        <h2 className="font-bold text-base mb-2">{post.title}</h2>
        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{bodyPreview}</p>
        {post.body.length > 300 && (
          <button onClick={() => setExpanded((v) => !v)} className="text-xs font-medium text-[#6699F3] hover:underline mt-1">
            {expanded ? "Ver menos" : "Ver mais"}
          </button>
        )}

        {/* Anexo de arquivo */}
        {post.attachment_url && (
          <a href={post.attachment_url} target="_blank" rel="noopener noreferrer"
            className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/40 text-sm text-foreground/70 hover:text-[#6699F3] hover:border-[#6699F3]/40 transition-colors w-fit">
            <Paperclip className="w-4 h-4 shrink-0" />
            <span className="truncate">{post.attachment_name || "Ver anexo"}</span>
          </a>
        )}
      </div>

      {/* Ações — desabilitadas se pendente */}
      <div className="px-5 py-3 flex items-center gap-4 border-t border-border/40">
        <button onClick={handleLike} disabled={isPending}
          className={cn("flex items-center gap-1.5 text-sm font-medium transition-colors",
            isPending ? "opacity-40 cursor-not-allowed" :
            liked ? "text-red-500" : "text-foreground/50 hover:text-red-400")}>
          <Heart className={cn("w-4 h-4", liked && "fill-current")} />
          <span>{likeCount > 0 ? likeCount : ""}</span>
        </button>

        <button onClick={handleToggleComments} disabled={isPending}
          className={cn("flex items-center gap-1.5 text-sm font-medium transition-colors",
            isPending ? "opacity-40 cursor-not-allowed" : "text-foreground/50 hover:text-[#6699F3]")}>
          <MessageCircle className="w-4 h-4" />
          <span>{commentCount} {commentCount === 1 ? "resposta" : "respostas"}</span>
          {showComments ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {showComments && (
        <div className="border-t border-border/40 bg-muted/30 px-5 py-4 space-y-4">
          {loadingComments && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {comments !== null && (
            <div className="space-y-3">
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">Nenhuma resposta ainda. Seja a primeira!</p>
              )}
              {comments.map((comment) => {
                const isAdmin = comment.profiles?.role === "admin";
                return (
                  <div key={comment.id} className="flex gap-2.5">
                    <Avatar name={comment.profiles?.full_name || "?"} url={comment.profiles?.avatar_url} size={7} />
                    <div className={cn("flex-1 min-w-0 rounded-lg px-3 py-2 border",
                      isAdmin ? "bg-[#6699F3]/5 border-[#6699F3]/20" : "bg-white border-border/40")}>
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold">{comment.profiles?.full_name || "Aluna"}</span>
                          {isAdmin && (
                            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-[#6699F3] bg-[#6699F3]/10 px-1.5 py-0.5 rounded">
                              <ShieldCheck className="w-2.5 h-2.5" /> Equipe Handify
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                          {comment.user_id === userId && (
                            <button onClick={() => handleDeleteComment(comment.id)}
                              className="text-muted-foreground hover:text-red-500 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-foreground/80 mt-0.5 whitespace-pre-line">{comment.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <form onSubmit={handleComment} className="flex gap-2.5">
            <Avatar name="Você" size={7} />
            <div className="flex-1 flex gap-2">
              <textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(e as unknown as React.FormEvent); } }}
                placeholder="Escreva sua resposta… (Enter para enviar)"
                rows={1} className="flex-1 resize-none rounded-lg border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6699F3]/30 placeholder:text-muted-foreground"
                style={{ minHeight: "38px" }} />
              <button type="submit" disabled={!commentBody.trim() || submitting}
                className="p-2 rounded-lg bg-[#6699F3] text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0 self-end">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </form>
        </div>
      )}
    </article>
  );
}
