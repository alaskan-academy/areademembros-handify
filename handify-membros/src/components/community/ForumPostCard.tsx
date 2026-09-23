"use client";

import CommentBox from "@/components/ui/comment-box";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Heart, MessageCircle, ChevronDown, ChevronUp, Trash2, Pin, Send, Loader2, Paperclip, Clock, ShieldCheck, ImageIcon, X, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { addForumComment, deleteForumComment, toggleForumLike, getForumComments, uploadForumFile } from "@/app/(student)/comunidade/forum/actions";
import type { ForumCommentRow, ForumCommentNode } from "@/app/(student)/comunidade/forum/actions";

export type ForumComment = ForumCommentRow;

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
  /** Link profundo: abre as respostas já na chegada. */
  abrirComentarios?: boolean;
  /** Link profundo: rola até este comentário e o destaca. */
  destacarComentarioId?: string | null;
}

function Avatar({ name, url, size = 8 }: { name: string; url?: string | null; size?: number }) {
  const initial = name?.charAt(0)?.toUpperCase() || "?";
  const px = size * 4;
  const cls = "rounded-full flex items-center justify-center font-bold text-white shrink-0";
  if (url) return <Image src={url} alt={name} width={px} height={px} className={`${cls} object-cover`} style={{ width: px, height: px }} />;
  return <div className={cls} style={{ width: px, height: px, background: "#6699F3", fontSize: size < 8 ? "0.65rem" : "0.875rem" }}>{initial}</div>;
}

/**
 * Tira um comentário da árvore sem perder as respostas dele.
 *
 * `forum_comments.parent_id` é `on delete set null`: no banco, apagar o
 * comentário de cima NÃO apaga as respostas — elas sobem para a raiz. A tela
 * faz o mesmo, senão a resposta de outra aluna sumiria na frente de quem está
 * lendo e voltaria sozinha no próximo carregamento.
 */
function removerComentario(nodes: ForumCommentNode[], id: string): ForumCommentNode[] {
  const saida: ForumCommentNode[] = [];
  for (const n of nodes) {
    if (n.id === id) {
      for (const r of n.respostas) saida.push({ ...r, respostas: [] });
      continue;
    }
    saida.push({ ...n, respostas: n.respostas.filter((r) => r.id !== id) });
  }
  return saida;
}

/** Um comentário: o de cima ou uma resposta dele. */
function Comentario({
  comment,
  userId,
  ehResposta,
  destacado,
  onResponder,
  onDelete,
}: {
  comment: ForumCommentRow;
  userId: string;
  ehResposta?: boolean;
  destacado?: boolean;
  onResponder: (c: ForumCommentRow) => void;
  onDelete: (id: string) => void;
}) {
  const [liked, setLiked] = useState(comment.liked);
  const [likeCount, setLikeCount] = useState(comment.like_count);
  const [, startTransition] = useTransition();

  const isAdmin = comment.profiles?.role === "admin";
  const nome = comment.profiles?.full_name || "Aluna";

  function curtir() {
    const antes = liked;
    setLiked(!antes);
    setLikeCount((c) => (antes ? Math.max(0, c - 1) : c + 1));
    startTransition(async () => {
      const r = await toggleForumLike(comment.id, "forum_comment");
      // Devolve o coração ao lugar quando o banco recusa: contagem que mente
      // é pior que contagem que não mudou.
      if (r.error) {
        setLiked(antes);
        setLikeCount((c) => (antes ? c + 1 : Math.max(0, c - 1)));
      }
    });
  }

  return (
    <div id={`comentario-${comment.id}`} className={cn("flex gap-2.5", ehResposta && "pl-3 border-l-2 border-[#6699F3]/20")}>
      <Avatar name={nome} url={comment.profiles?.avatar_url} size={7} />
      <div
        className={cn(
          "flex-1 min-w-0 rounded-lg px-3 py-2 border handify-transition",
          isAdmin ? "bg-[#6699F3]/5 border-[#6699F3]/20" : "bg-white border-border/40",
          destacado && "ring-2 ring-[#6699F3]/50 border-[#6699F3]/40"
        )}
      >
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold">{nome}</span>
            {isAdmin && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-[#6699F3] bg-[#6699F3]/10 px-1.5 py-0.5 rounded">
                <ShieldCheck className="w-2.5 h-2.5" /> Equipe Handify
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
            </span>
            {comment.user_id === userId && (
              <button onClick={() => onDelete(comment.id)}
                aria-label="Deletar comentário"
                className="text-muted-foreground hover:text-red-500 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-foreground/80 mt-0.5 whitespace-pre-line">{comment.body}</p>

        {comment.image_url && (
          <a
            href={comment.image_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 rounded-lg overflow-hidden border border-border/60 w-fit max-w-full"
          >
            <Image
              src={comment.image_url}
              alt="Foto enviada na resposta"
              width={420}
              height={420}
              sizes="(max-width: 640px) 80vw, 420px"
              className="w-auto h-auto max-h-72 object-contain"
            />
          </a>
        )}

        {comment.attachment_url && (
          <a
            href={comment.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#6699F3] hover:underline min-h-[44px] py-2"
          >
            <Paperclip className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[220px]">
              {comment.attachment_name || "Ver anexo"}
            </span>
          </a>
        )}

        {/* Curtir e responder — o que não existia até aqui: 246 comentários,
            nenhuma curtida e nenhuma resposta, porque não havia botão. */}
        <div className="flex items-center gap-1 mt-1 -ml-1">
          <button
            onClick={curtir}
            aria-label={liked ? "Descurtir comentário" : "Curtir comentário"}
            aria-pressed={liked}
            className={cn(
              "inline-flex items-center gap-1 px-2 min-h-[44px] text-xs font-medium handify-transition",
              liked ? "text-red-500" : "text-foreground/50 hover:text-red-400"
            )}
          >
            <Heart className={cn("w-3.5 h-3.5", liked && "fill-current")} />
            <span>{likeCount > 0 ? likeCount : ""}</span>
          </button>
          <button
            onClick={() => onResponder(comment)}
            aria-label={`Responder a ${nome}`}
            className="inline-flex items-center gap-1 px-2 min-h-[44px] text-xs font-medium text-foreground/50 hover:text-[#6699F3] handify-transition"
          >
            <CornerDownRight className="w-3.5 h-3.5" />
            <span>Responder</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ForumPostCard({ post, userId, initialLiked, onDelete, abrirComentarios, destacarComentarioId }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<ForumCommentNode[] | null>(null);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [, startTransition] = useTransition();
  // Anexos da resposta — a URL já vem do bucket, o upload acontece na escolha
  // do arquivo e não no envio, para a aluna ver a miniatura antes de mandar.
  const [imagemComentario, setImagemComentario] = useState("");
  const [anexoComentario, setAnexoComentario] = useState("");
  const [anexoNome, setAnexoNome] = useState("");
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);
  // A quem esta resposta responde. Um campo só embaixo, como no Instagram:
  // caixa de texto dentro de cada comentário empilharia três uploads abertos
  // ao mesmo tempo no celular.
  const [respondendoA, setRespondendoA] = useState<{ id: string; nome: string } | null>(null);
  const inputImagemRef = useRef<HTMLInputElement>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);

  const isPending = !post.approved && post.user_id === userId;
  const bodyPreview = post.body.length > 300 && !expanded ? post.body.slice(0, 300) + "…" : post.body;

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    const data = await getForumComments(post.id);
    setComments(data);
    setLoadingComments(false);
  }, [post.id]);

  function handleToggleComments() {
    if (!showComments && comments === null) void loadComments();
    setShowComments((v) => !v);
  }

  // Link profundo do sino: /comunidade/forum/<slug>?post=…&comentario=…
  // Sem isto a equipe clicava no aviso e caía na lista, sem achar o comentário.
  const jaAbriuPeloLink = useRef(false);
  useEffect(() => {
    if (!abrirComentarios || jaAbriuPeloLink.current) return;
    jaAbriuPeloLink.current = true;
    setShowComments(true);
    void loadComments();
  }, [abrirComentarios, loadComments]);

  useEffect(() => {
    if (!destacarComentarioId || comments === null) return;
    const el = document.getElementById(`comentario-${destacarComentarioId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [destacarComentarioId, comments]);

  function handleLike() {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => (wasLiked ? c - 1 : c + 1));
    startTransition(async () => { await toggleForumLike(post.id, "forum_post"); });
  }

  function responderA(c: ForumCommentRow) {
    setRespondendoA({ id: c.id, nome: c.profiles?.full_name || "Aluna" });
    // Leva o cursor para a caixa — no celular ela fica abaixo da dobra.
    requestAnimationFrame(() => {
      const campo = composerRef.current?.querySelector("textarea");
      campo?.focus();
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function handleUploadComentario(
    e: React.ChangeEvent<HTMLInputElement>,
    tipo: "image" | "file"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoAnexo(true);
    setErroAnexo(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("file_type", tipo);
    const r = await uploadForumFile(fd);
    setEnviandoAnexo(false);
    // Limpa o input sempre: sem isso, escolher o MESMO arquivo de novo depois de
    // um erro não dispara change e a aluna acha que a tela travou.
    e.target.value = "";
    if (r.error) { setErroAnexo(r.error); return; }
    if (tipo === "image") setImagemComentario(r.url ?? "");
    else { setAnexoComentario(r.url ?? ""); setAnexoNome(r.name ?? file.name); }
  }

  function limparAnexos() {
    setImagemComentario("");
    setAnexoComentario("");
    setAnexoNome("");
    setErroAnexo(null);
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    // Resposta só com foto é resposta legítima num fórum de artesanato.
    const temConteudo = commentBody.trim() || imagemComentario || anexoComentario;
    if (!temConteudo || submitting || enviandoAnexo) return;
    setSubmitting(true);
    setErroAnexo(null);
    const result = await addForumComment(
      post.id,
      commentBody.trim() || "📷",
      {
        imageUrl: imagemComentario || null,
        attachmentUrl: anexoComentario || null,
        attachmentName: anexoNome || null,
      },
      respondendoA?.id ?? null
    );
    setSubmitting(false);
    if ("error" in result) { setErroAnexo(result.error); return; }

    // Um nível só: a resposta entra sob a RAIZ do fio, que pode não ser o pai
    // direto (responder a uma resposta). Mesma regra de
    // `montarArvoreDeComentarios`, que é quem monta isto no recarregamento.
    setComments((prev) => {
      const atual = prev ?? [];
      const pai = result.parent_id;
      if (!pai) return [...atual, { ...result, respostas: [] }];
      const raiz = atual.find(
        (n) => n.id === pai || n.respostas.some((r) => r.id === pai)
      );
      // Pai fora da lista (apagado enquanto ela escrevia): aparece solto em vez
      // de sumir da tela.
      if (!raiz) return [...atual, { ...result, respostas: [] }];
      return atual.map((n) =>
        n.id === raiz.id ? { ...n, respostas: [...n.respostas, result] } : n
      );
    });
    setCommentCount((c) => c + 1);
    setCommentBody("");
    setRespondendoA(null);
    limparAnexos();
  }

  async function handleDeleteComment(commentId: string) {
    await deleteForumComment(commentId);
    setComments((prev) => removerComentario(prev ?? [], commentId));
    setCommentCount((c) => Math.max(0, c - 1));
    if (respondendoA?.id === commentId) setRespondendoA(null);
  }

  const authorName = post.author?.full_name || "Aluna";
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR });
  const isOwner = post.user_id === userId;

  return (
    <article id={`post-${post.id}`} className={cn(
      "bg-white rounded-xl border shadow-sm overflow-hidden handify-transition",
      isPending ? "border-[#FEC649]/40 bg-[#FEC649]/5" : "border-border/60",
      abrirComentarios && "ring-2 ring-[#6699F3]/40"
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
                <span className="flex items-center gap-1 text-xs font-semibold text-[#6699F3] bg-[#6699F3]/10 px-2 py-0.5 rounded-full">
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

      {/* Imagem — acima do texto, proporcional sem corte */}
      {post.image_url && (
        <div className="w-full bg-muted/30 flex items-center justify-center">
          <img
            src={post.image_url}
            alt={post.title}
            className="w-full object-contain"
            style={{ maxHeight: 480 }}
          />
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
      <div id="tour-forum-acoes" className="px-5 py-3 flex items-center gap-4 border-t border-border/40">
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
              {comments.map((comment) => (
                <div key={comment.id} className="space-y-2">
                  <Comentario
                    comment={comment}
                    userId={userId}
                    destacado={destacarComentarioId === comment.id}
                    onResponder={responderA}
                    onDelete={handleDeleteComment}
                  />
                  {comment.respostas.length > 0 && (
                    <div className="ml-7 space-y-2">
                      {comment.respostas.map((resposta) => (
                        <Comentario
                          key={resposta.id}
                          comment={resposta}
                          userId={userId}
                          ehResposta
                          destacado={destacarComentarioId === resposta.id}
                          onResponder={responderA}
                          onDelete={handleDeleteComment}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <form ref={composerRef} onSubmit={handleComment} className="flex gap-2.5">
            <Avatar name="Você" size={7} />
            <div className="flex-1 min-w-0 space-y-2">
              {respondendoA && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-[#6699F3]/10 rounded-lg pl-2.5 pr-1 py-1.5 w-fit max-w-full">
                  <CornerDownRight className="w-3 h-3 shrink-0 text-[#6699F3]" />
                  <span className="truncate">Respondendo a <strong className="font-semibold text-foreground/80">{respondendoA.nome}</strong></span>
                  <button
                    type="button"
                    onClick={() => setRespondendoA(null)}
                    aria-label="Cancelar resposta"
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <CommentBox
                  value={commentBody}
                  onChange={setCommentBody}
                  onSubmit={() => handleComment({ preventDefault: () => {} } as React.FormEvent)}
                  placeholder={
                    respondendoA
                      ? `Responder a ${respondendoA.nome}…`
                      : "Escreva sua resposta… (Enter para enviar, Shift+Enter quebra linha)"
                  }
                  ariaLabel="Escreva sua resposta"
                  className="bg-white"
                />
                <button
                  type="submit"
                  disabled={
                    (!commentBody.trim() && !imagemComentario && !anexoComentario) ||
                    submitting ||
                    enviandoAnexo
                  }
                  aria-label="Enviar resposta"
                  className="p-2 rounded-lg bg-[#6699F3] text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0 self-end min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>

              {/* Prévias — a aluna confere antes de enviar e pode tirar */}
              {(imagemComentario || anexoComentario) && (
                <div className="flex flex-wrap items-center gap-2">
                  {imagemComentario && (
                    <div className="relative">
                      <Image
                        src={imagemComentario}
                        alt="Prévia da foto"
                        width={72}
                        height={72}
                        className="w-18 h-18 object-cover rounded-lg border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => setImagemComentario("")}
                        aria-label="Remover foto"
                        className="absolute -top-1.5 -right-1.5 bg-foreground text-background rounded-full p-1 shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {anexoComentario && (
                    <span className="inline-flex items-center gap-1.5 text-xs bg-muted rounded-lg pl-2.5 pr-1 py-1.5 max-w-full">
                      <Paperclip className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[160px]">{anexoNome}</span>
                      <button
                        type="button"
                        onClick={() => { setAnexoComentario(""); setAnexoNome(""); }}
                        aria-label="Remover anexo"
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1">
                <input
                  ref={inputImagemRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => handleUploadComentario(e, "image")}
                />
                <input
                  ref={inputArquivoRef}
                  type="file"
                  accept=".pdf,.zip,.rar,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*"
                  className="hidden"
                  onChange={(e) => handleUploadComentario(e, "file")}
                />
                <button
                  type="button"
                  onClick={() => inputImagemRef.current?.click()}
                  disabled={enviandoAnexo}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#6699F3] transition-colors px-2 py-2 min-h-[44px] disabled:opacity-50"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Foto</span>
                </button>
                <button
                  type="button"
                  onClick={() => inputArquivoRef.current?.click()}
                  disabled={enviandoAnexo}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#6699F3] transition-colors px-2 py-2 min-h-[44px] disabled:opacity-50"
                >
                  <Paperclip className="w-4 h-4" />
                  <span>Anexo</span>
                </button>
                {enviandoAnexo && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> enviando…
                  </span>
                )}
              </div>

              {erroAnexo && <p className="text-xs text-red-600">{erroAnexo}</p>}
            </div>
          </form>
        </div>
      )}
    </article>
  );
}
