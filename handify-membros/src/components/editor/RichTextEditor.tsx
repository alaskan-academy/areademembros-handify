"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { useCallback, useState } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Unlink,
  Highlighter, Palette,
  Undo, Redo, Quote, CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Cores predefinidas (Handify + básicas) ────────────────────────────────

const TEXT_COLORS = [
  { label: "Padrão", value: "" },
  { label: "Azul Handify", value: "#6699F3" },
  { label: "Verde Handify", value: "#72CF92" },
  { label: "Amarelo Handify", value: "#FEC649" },
  { label: "Preto", value: "#0F0F0F" },
  { label: "Cinza", value: "#2D2D2D" },
  { label: "Vermelho", value: "#EF4444" },
  { label: "Roxo", value: "#8B5CF6" },
];

const HIGHLIGHT_COLORS = [
  { label: "Amarelo", value: "#FEF08A" },
  { label: "Verde", value: "#BBF7D0" },
  { label: "Azul", value: "#BFDBFE" },
  { label: "Lilás", value: "#E9D5FF" },
  { label: "Rosa", value: "#FBCFE8" },
];

// ─── Botão da toolbar ──────────────────────────────────────────────────────

function ToolBtn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors",
        active
          ? "bg-[#6699F3] text-white"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
        disabled && "opacity-30 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
}

// ─── Picker de cor (texto ou highlight) ────────────────────────────────────

function ColorPicker({
  title,
  icon,
  colors,
  onSelect,
  currentColor,
}: {
  title: string;
  icon: React.ReactNode;
  colors: { label: string; value: string }[];
  onSelect: (v: string) => void;
  currentColor?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        title={title}
        className="flex items-center gap-0.5 p-1.5 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        {icon}
        {currentColor && (
          <span
            className="w-2 h-2 rounded-full border border-white/50"
            style={{ background: currentColor }}
          />
        )}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onMouseDown={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-border rounded-lg shadow-lg p-2 flex flex-col gap-1 min-w-[140px]">
            {colors.map((c) => (
              <button
                key={c.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(c.value);
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted text-sm text-left"
              >
                <span
                  className="w-4 h-4 rounded border border-border shrink-0"
                  style={{ background: c.value || "transparent" }}
                />
                {c.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Dialog de link ────────────────────────────────────────────────────────

function LinkDialog({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  const openDialog = () => {
    const current = editor.getAttributes("link").href as string ?? "";
    setUrl(current);
    setOpen(true);
  };

  const apply = () => {
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
    }
    setOpen(false);
    setUrl("");
  };

  const isActive = editor.isActive("link");

  return (
    <>
      <ToolBtn onClick={openDialog} active={isActive} title="Inserir link">
        <LinkIcon className="w-3.5 h-3.5" />
      </ToolBtn>
      {isActive && (
        <ToolBtn
          onClick={() => editor.chain().focus().unsetLink().run()}
          title="Remover link"
        >
          <Unlink className="w-3.5 h-3.5" />
        </ToolBtn>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-5 w-80 space-y-3">
            <p className="font-semibold text-sm">Inserir link</p>
            <input
              autoFocus
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6699F3]/40"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={apply}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#6699F3] text-white hover:bg-[#5580d4]"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Toolbar ───────────────────────────────────────────────────────────────

function Toolbar({ editor }: { editor: Editor }) {
  const setColor = useCallback((color: string) => {
    if (!color) editor.chain().focus().unsetColor().run();
    else editor.chain().focus().setColor(color).run();
  }, [editor]);

  const setHighlight = useCallback((color: string) => {
    editor.chain().focus().toggleHighlight({ color }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/40">
      {/* Undo/Redo */}
      <ToolBtn
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Desfazer"
      >
        <Undo className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Refazer"
      >
        <Redo className="w-3.5 h-3.5" />
      </ToolBtn>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Títulos */}
      <ToolBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
        title="Título 1"
      >
        <Heading1 className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="Título 2"
      >
        <Heading2 className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="Título 3"
      >
        <Heading3 className="w-3.5 h-3.5" />
      </ToolBtn>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Formatação de texto */}
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Negrito"
      >
        <Bold className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Itálico"
      >
        <Italic className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
        title="Sublinhado"
      >
        <UnderlineIcon className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="Tachado"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </ToolBtn>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Cor de texto */}
      <ColorPicker
        title="Cor do texto"
        icon={<Palette className="w-3.5 h-3.5" />}
        colors={TEXT_COLORS}
        onSelect={setColor}
        currentColor={editor.getAttributes("textStyle").color as string}
      />

      {/* Highlight */}
      <ColorPicker
        title="Destaque (highlight)"
        icon={<Highlighter className="w-3.5 h-3.5" />}
        colors={HIGHLIGHT_COLORS}
        onSelect={setHighlight}
      />

      <div className="w-px h-4 bg-border mx-1" />

      {/* Listas */}
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="Lista com marcadores"
      >
        <List className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        title="Lista numerada"
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Citação"
      >
        <Quote className="w-3.5 h-3.5" />
      </ToolBtn>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Alinhamento */}
      <ToolBtn
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        active={editor.isActive({ textAlign: "left" })}
        title="Alinhar à esquerda"
      >
        <AlignLeft className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        active={editor.isActive({ textAlign: "center" })}
        title="Centralizar"
      >
        <AlignCenter className="w-3.5 h-3.5" />
      </ToolBtn>
      <ToolBtn
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        active={editor.isActive({ textAlign: "right" })}
        title="Alinhar à direita"
      >
        <AlignRight className="w-3.5 h-3.5" />
      </ToolBtn>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Quebra de linha */}
      <ToolBtn
        onClick={() => editor.chain().focus().setHardBreak().run()}
        title="Quebra de linha (↵)"
      >
        <CornerDownLeft className="w-3.5 h-3.5" />
      </ToolBtn>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Link */}
      <LinkDialog editor={editor} />
    </div>
  );
}

// ─── Editor principal ──────────────────────────────────────────────────────

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Digite o conteúdo...",
  minHeight = 180,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: value || "<p></p>",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class: "focus:outline-none prose prose-sm max-w-none text-foreground p-3",
        style: `min-height:${minHeight}px`,
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background focus-within:ring-2 focus-within:ring-[#6699F3]/40">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
