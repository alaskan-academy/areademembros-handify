"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Heart, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toggleNewsLike } from "@/app/(student)/comunidade/feed/actions";

export type FeedPostData = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  pinned: boolean;
  created_at: string;
  author: { full_name: string; avatar_url: string | null } | null;
  like_count: number;
};

interface Props {
  post: FeedPostData;
  userId: string;
  initialLiked: boolean;
}

function Avatar({ name, url, size = 8 }: { name: string; url?: string | null; size?: number }) {
  const initial = name?.charAt(0)?.toUpperCase() || "?";
  const px = size * 4;
  const cls = "rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0";
  if (url) return <Image src={url} alt={name} width={px} height={px} className={`${cls} object-cover`} style={{ width: px, height: px }} />;
  return <div className={cls} style={{ width: px, height: px, background: "#6699F3", fontSize: size < 8 ? "0.6rem" : undefined }}>{initial}</div>;
}

export default function FeedPostCard({ post, userId: _userId, initialLiked }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();

  const bodyPreview = post.body.length > 300 && !expanded ? post.body.slice(0, 300) + "…" : post.body;

  function handleLike() {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => (wasLiked ? c - 1 : c + 1));
    startTransition(async () => {
      await toggleNewsLike(post.id);
    });
  }

  const authorName = post.author?.full_name || "Handify";
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR });

  return (
    <article className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
      {/* Header do post */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start gap-3">
          <Avatar name={authorName} url={post.author?.avatar_url} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground">{authorName}</span>
              {post.pinned && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#6699F3] bg-[#6699F3]/10 px-2 py-0.5 rounded-full">
                  <Pin className="w-2.5 h-2.5" /> Fixado
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
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
        <h2 className="font-bold text-base text-foreground mb-2">{post.title}</h2>

        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">{bodyPreview}</p>
        {post.body.length > 300 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-[#6699F3] hover:underline mt-1"
          >
            {expanded ? "Ver menos" : "Ver mais"}
          </button>
        )}
      </div>

      {/* Ações */}
      <div className="px-5 py-3 flex items-center gap-4 border-t border-border/40">
        <button
          onClick={handleLike}
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium transition-colors",
            liked ? "text-red-500" : "text-foreground/50 hover:text-red-400"
          )}
          aria-label={liked ? "Descurtir" : "Curtir"}
        >
          <Heart className={cn("w-4 h-4", liked && "fill-current")} />
          <span>{likeCount > 0 ? likeCount : ""}</span>
        </button>
      </div>
    </article>
  );
}
