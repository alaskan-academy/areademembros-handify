"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2, Pin, PinOff, ExternalLink, CheckCircle, XCircle, Clock, Paperclip } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { approveForumPost, rejectForumPost, deleteAdminForumPost, toggleAdminForumPin } from "./actions";

type ForumPostRow = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  approved: boolean;
  created_at: string;
  course_id: string;
  attachment_url: string | null;
  attachment_name: string | null;
  author_name: string;
  course_title: string;
  course_slug: string;
  comment_count: number;
};

interface Props {
  posts: ForumPostRow[];
}

export default function ForumModerationClient({ posts: initialPosts }: Props) {
  const [posts, setPosts] = useState<ForumPostRow[]>(initialPosts);
  const [, startTransition] = useTransition();

  function handleApprove(id: string, courseSlug: string) {
    startTransition(async () => {
      const result = await approveForumPost(id, courseSlug);
      if (!result.error) setPosts((prev) => prev.map((p) => p.id === id ? { ...p, approved: true } : p));
    });
  }

  function handleReject(id: string, courseSlug: string) {
    if (!confirm("Rejeitar e deletar este post? Esta ação não pode ser desfeita.")) return;
    startTransition(async () => {
      const result = await rejectForumPost(id, courseSlug);
      if (!result.error) setPosts((prev) => prev.filter((p) => p.id !== id));
    });
  }

  function handleDelete(id: string, courseSlug: string) {
    if (!confirm("Deletar este post? Esta ação não pode ser desfeita.")) return;
    startTransition(async () => {
      const result = await deleteAdminForumPost(id, courseSlug);
      if (!result.error) setPosts((prev) => prev.filter((p) => p.id !== id));
    });
  }

  function handleTogglePin(id: string, current: boolean) {
    startTransition(async () => {
      const result = await toggleAdminForumPin(id, current);
      if (!result.error) setPosts((prev) => prev.map((p) => p.id === id ? { ...p, pinned: !current } : p));
    });
  }

  const pending = posts.filter((p) => !p.approved);
  const approved = posts.filter((p) => p.approved);

  if (posts.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="font-medium">Nenhum post no fórum ainda</p>
      </div>
    );
  }

  const PostCard = ({ post }: { post: ForumPostRow }) => (
    <div key={post.id} className={cn(
      "bg-white rounded-xl border shadow-sm p-4",
      !post.approved ? "border-[#FEC649]/40 bg-[#FEC649]/5" : "border-border/60"
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold text-[#6699F3] bg-[#6699F3]/10 px-2 py-0.5 rounded-full">
              {post.course_title}
            </span>
            {!post.approved && (
              <span className="flex items-center gap-1 text-xs font-semibold text-[#b8900d] bg-[#FEC649]/15 px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3" /> Pendente
              </span>
            )}
            {post.pinned && (
              <span className="text-xs font-semibold text-[#72CF92] bg-[#72CF92]/10 px-2 py-0.5 rounded-full">Fixado</span>
            )}
          </div>
          <h3 className="font-semibold text-sm text-foreground line-clamp-1 mb-0.5">{post.title}</h3>
          <p className="text-xs text-foreground/70 line-clamp-2 mb-2">{post.body}</p>
          {post.attachment_url && (
            <a href={post.attachment_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-[#6699F3] hover:underline mb-2">
              <Paperclip className="w-3 h-3" />
              {post.attachment_name || "Ver anexo"}
            </a>
          )}
          <p className="text-[10px] text-muted-foreground">
            por <strong>{post.author_name}</strong> ·{" "}
            {post.comment_count} {post.comment_count === 1 ? "resposta" : "respostas"} ·{" "}
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
          </p>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          {/* Approve/reject para posts pendentes */}
          {!post.approved && (
            <div className="flex gap-1 mb-1">
              <button
                onClick={() => handleApprove(post.id, post.course_slug)}
                title="Aprovar post"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-white bg-[#72CF92] hover:opacity-90 transition-opacity"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Aprovar
              </button>
              <button
                onClick={() => handleReject(post.id, post.course_slug)}
                title="Rejeitar e deletar"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-white bg-red-500 hover:opacity-90 transition-opacity"
              >
                <XCircle className="w-3.5 h-3.5" /> Rejeitar
              </button>
            </div>
          )}

          <div className="flex gap-1">
            {post.course_slug && (
              <Link
                href={`/comunidade/forum/${post.course_slug}`}
                target="_blank"
                title="Ver no fórum"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-[#6699F3] hover:bg-[#6699F3]/10 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            )}
            {post.approved && (
              <button
                onClick={() => handleTogglePin(post.id, post.pinned)}
                title={post.pinned ? "Desfixar" : "Fixar no topo"}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-[#FEC649] hover:bg-[#FEC649]/10 transition-colors"
              >
                {post.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={() => handleDelete(post.id, post.course_slug)}
              title="Deletar post"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-[#b8900d] uppercase tracking-wide mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Aguardando aprovação ({pending.length})
          </h2>
          <div className="space-y-3">
            {pending.map((post) => <PostCard key={post.id} post={post} />)}
          </div>
        </section>
      )}

      {approved.length > 0 && (
        <section>
          {pending.length > 0 && (
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">
              Posts aprovados ({approved.length})
            </h2>
          )}
          <div className="space-y-3">
            {approved.map((post) => <PostCard key={post.id} post={post} />)}
          </div>
        </section>
      )}
    </div>
  );
}
