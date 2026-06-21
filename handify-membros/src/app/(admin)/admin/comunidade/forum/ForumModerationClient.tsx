"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, Pin, PinOff, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";

type ForumPostRow = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
  course_id: string;
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

  async function handleDelete(id: string) {
    if (!confirm("Deletar este post? Esta ação não pode ser desfeita.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("forum_posts").delete().eq("id", id);
    if (!error) setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleTogglePin(id: string, current: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from("forum_posts").update({ pinned: !current }).eq("id", id);
    if (!error) setPosts((prev) => prev.map((p) => p.id === id ? { ...p, pinned: !current } : p));
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="font-medium">Nenhum post no fórum ainda</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <div key={post.id} className="bg-white rounded-xl border border-border/60 shadow-sm p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-semibold text-[#6699F3] bg-[#6699F3]/10 px-2 py-0.5 rounded-full">
                  {post.course_title}
                </span>
                {post.pinned && (
                  <span className="text-xs font-semibold text-[#FEC649] bg-[#FEC649]/10 px-2 py-0.5 rounded-full">Fixado</span>
                )}
              </div>
              <h3 className="font-semibold text-sm text-foreground line-clamp-1 mb-0.5">{post.title}</h3>
              <p className="text-xs text-foreground/70 line-clamp-2 mb-2">{post.body}</p>
              <p className="text-[10px] text-muted-foreground">
                por <strong>{post.author_name}</strong> ·{" "}
                {post.comment_count} {post.comment_count === 1 ? "resposta" : "respostas"} ·{" "}
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>

            <div className="flex gap-1 shrink-0">
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
              <button
                onClick={() => handleTogglePin(post.id, post.pinned)}
                title={post.pinned ? "Desfixar" : "Fixar no topo"}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-[#FEC649] hover:bg-[#FEC649]/10 transition-colors"
              >
                {post.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </button>
              <button
                onClick={() => handleDelete(post.id)}
                title="Deletar post"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
