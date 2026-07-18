import { useEditor, EditorContent, type Editor, Node, mergeAttributes } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";

/**
 * Custom Tiptap node: image carousel.
 * Atom node — stores items as a JSON attribute so Tiptap doesn't strip the
 * wrapper on paste/insert (which would leave images as individual blocks).
 */
const ImageCarousel = Node.create({
  name: "imageCarousel",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      items: {
        default: [] as Array<{ src: string; alt?: string }>,
        parseHTML: (el) => {
          const raw = (el as HTMLElement).getAttribute("data-items");
          if (raw) {
            try {
              return JSON.parse(raw);
            } catch {
              /* fall through */
            }
          }
          return Array.from(el.querySelectorAll("img")).map((img) => ({
            src: img.getAttribute("src") || "",
            alt: img.getAttribute("alt") || "",
          }));
        },
        renderHTML: (attrs) => ({
          "data-items": JSON.stringify(attrs.items ?? []),
        }),
      },
    };
  },
  parseHTML() {
    return [
      { tag: 'div[data-type="image-carousel"]' },
      { tag: 'div.media-carousel[data-type="images"]' },
    ];
  },
  renderHTML({ HTMLAttributes, node }) {
    const items = (node.attrs.items as Array<{ src: string; alt?: string }>) ?? [];
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "media-carousel",
        "data-type": "images",
      }),
      [
        "div",
        { class: "media-carousel-track" },
        ...items.map((i) => [
          "figure",
          { class: "media-carousel-item" },
          ["img", { src: i.src, alt: i.alt ?? "", loading: "lazy" }],
        ]),
      ],
    ];
  },
});

/**
 * Custom Tiptap node: video carousel (YouTube/Vimeo embeds).
 */
const VideoCarousel = Node.create({
  name: "videoCarousel",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      items: {
        default: [] as Array<{ src: string }>,
        parseHTML: (el) => {
          const raw = (el as HTMLElement).getAttribute("data-items");
          if (raw) {
            try {
              return JSON.parse(raw);
            } catch {
              /* fall through */
            }
          }
          return Array.from(el.querySelectorAll("iframe")).map((f) => ({
            src: f.getAttribute("src") || "",
          }));
        },
        renderHTML: (attrs) => ({
          "data-items": JSON.stringify(attrs.items ?? []),
        }),
      },
    };
  },
  parseHTML() {
    return [
      { tag: 'div[data-type="video-carousel"]' },
      { tag: 'div.media-carousel[data-type="videos"]' },
    ];
  },
  renderHTML({ HTMLAttributes, node }) {
    const items = (node.attrs.items as Array<{ src: string }>) ?? [];
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "media-carousel",
        "data-type": "videos",
      }),
      [
        "div",
        { class: "media-carousel-track" },
        ...items.map((i) => [
          "div",
          { class: "media-carousel-item" },
          [
            "iframe",
            {
              src: i.src,
              loading: "lazy",
              allow:
                "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
              allowfullscreen: "true",
              frameborder: "0",
            },
          ],
        ]),
      ],
    ];
  },
});

import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Images as ImagesIcon,
  Youtube as YoutubeIcon,
  Film,
  Undo2,
  Redo2,
  Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadResponsiveImage, ALLOWED_IMAGE_TYPES } from "@/lib/image-upload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichEditor({ value, onChange, placeholder }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoUrls, setVideoUrls] = useState("");

  // Guarda o último HTML emitido pelo próprio editor, para diferenciar
  // mudanças internas (digitação, upload de imagem) de mudanças externas
  // (ex.: aplicar rascunho da IA). Sem isso, um sync ingênuo por string
  // pode reescrever o conteúdo do editor logo após uma inserção e apagar
  // imagens recém-enviadas.
  const lastEmittedRef = useRef<string>(value || "");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
      Youtube.configure({ width: 640, height: 360, controls: true, nocookie: true }),
      ImageCarousel,
      VideoCarousel,
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmittedRef.current = html;
      onChange(html);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base max-w-none min-h-[280px] focus:outline-none px-4 py-3 dark:prose-invert",
      },
    },
  });

  // Só re-sincroniza o editor quando o `value` mudou por FORA (não foi o
  // próprio editor que emitiu). Isso suporta o fluxo "Aplicar ao editor"
  // da IA sem sobrescrever inserções internas (imagens, texto).
  useEffect(() => {
    if (!editor) return;
    const next = value || "";
    if (next === lastEmittedRef.current) return;
    lastEmittedRef.current = next;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [value, editor]);

  // Progressive enhancement dos carrosséis DENTRO do editor: injeta
  // botões prev/next, dots e autoplay de 3s para o usuário ver o carrossel
  // funcionando enquanto edita — mesmo comportamento da página pública.
  useEffect(() => {
    if (!editor) return;
    const root = editor.view.dom as HTMLElement;
    const run = () => enhanceEditorCarousels(root);
    run();
    const mo = new MutationObserver(() => run());
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [editor]);

  if (!editor) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-border bg-card">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleAddLink = () => {
    const url = window.prompt("URL do link:");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const handleAddYoutube = () => {
    const url = window.prompt("URL do vídeo (YouTube ou Vimeo):");
    if (!url) return;
    editor.chain().focus().setYoutubeVideo({ src: url }).run();
  };

  const handleImage = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadResponsiveImage(file, "posts");
      if (!result.ok) {
        toast.error(result.error.title, { description: result.error.description, duration: 10000 });
        return;
      }
      editor.chain().focus().setImage({ src: result.url, alt: file.name }).run();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleImageGallery = async (files: FileList) => {
    if (!files || files.length === 0) return;
    if (files.length === 1) {
      await handleImage(files[0]);
      return;
    }
    setUploadingGallery(true);
    try {
      const uploaded: Array<{ src: string; alt: string }> = [];
      for (const file of Array.from(files)) {
        const result = await uploadResponsiveImage(file, "posts");
        if (!result.ok) {
          toast.error(result.error.title, {
            description: result.error.description,
            duration: 10000,
          });
          continue;
        }
        uploaded.push({ src: result.url, alt: file.name });
      }
      if (uploaded.length === 0) return;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "imageCarousel",
          attrs: { items: uploaded },
        })
        .run();
      toast.success(`${uploaded.length} imagens adicionadas ao carrossel.`);
    } finally {
      setUploadingGallery(false);
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const handleAddVideoCarousel = () => {
    setVideoUrls("");
    setVideoDialogOpen(true);
  };

  const submitVideoCarousel = () => {
    const urls = videoUrls
      .split(/\r?\n|,/)
      .map((u) => u.trim())
      .filter(Boolean);
    const embeds = urls.map(toEmbedUrl).filter((u): u is string => Boolean(u));
    if (embeds.length === 0) {
      toast.error("Nenhuma URL válida do YouTube/Vimeo foi encontrada.");
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: "videoCarousel",
        attrs: { items: embeds.map((src) => ({ src })) },
      })
      .run();
    toast.success(`${embeds.length} item(ns) adicionado(s) ao carrossel.`);
    setVideoDialogOpen(false);
    setVideoUrls("");
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <Toolbar
        editor={editor}
        uploading={uploading}
        uploadingGallery={uploadingGallery}
        onAddLink={handleAddLink}
        onAddYoutube={handleAddYoutube}
        onPickImage={() => fileRef.current?.click()}
        onPickGallery={() => galleryRef.current?.click()}
        onAddVideoCarousel={handleAddVideoCarousel}
      />
      <input
        ref={fileRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImage(f);
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleImageGallery(e.target.files);
        }}
      />
      <EditorContent editor={editor} placeholder={placeholder} />

      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar carrossel de vídeos</DialogTitle>
            <DialogDescription>
              Cole URLs do YouTube/Vimeo — uma por linha ou separadas por vírgula. Playlists do
              YouTube (<code>?list=…</code>) também são aceitas.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            rows={8}
            placeholder={
              "https://youtu.be/VIDEO_ID\nhttps://www.youtube.com/watch?v=VIDEO_ID\nhttps://www.youtube.com/playlist?list=PLAYLIST_ID"
            }
            value={videoUrls}
            onChange={(e) => setVideoUrls(e.target.value)}
            className="font-mono text-sm"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setVideoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitVideoCarousel} disabled={!videoUrls.trim()}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const listId = u.searchParams.get("list");

    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      if (!id) return null;
      const params = new URLSearchParams({ enablejsapi: "1" });
      if (listId) params.set("list", listId);
      return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      // Playlist puro: /playlist?list=... → embed videoseries
      if (u.pathname === "/playlist" && listId) {
        return `https://www.youtube-nocookie.com/embed/videoseries?list=${listId}&enablejsapi=1`;
      }
      const id = u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop() || "";
      if (!id)
        return listId
          ? `https://www.youtube-nocookie.com/embed/videoseries?list=${listId}&enablejsapi=1`
          : null;
      const params = new URLSearchParams({ enablejsapi: "1" });
      if (listId) params.set("list", listId);
      return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
    }
    if (host.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "player.vimeo.com") return u.toString();
    return null;
  } catch {
    return null;
  }
}

function ToolBtn({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("h-8 w-8", active && "bg-secondary text-primary")}
    >
      {children}
    </Button>
  );
}

function Toolbar({
  editor,
  uploading,
  uploadingGallery,
  onAddLink,
  onAddYoutube,
  onPickImage,
  onPickGallery,
  onAddVideoCarousel,
}: {
  editor: Editor;
  uploading: boolean;
  uploadingGallery: boolean;
  onAddLink: () => void;
  onAddYoutube: () => void;
  onPickImage: () => void;
  onPickGallery: () => void;
  onAddVideoCarousel: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
      <ToolBtn
        label="Negrito"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </ToolBtn>
      <ToolBtn
        label="Itálico"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </ToolBtn>
      <ToolBtn
        label="Tachado"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-4" />
      </ToolBtn>
      <ToolBtn
        label="Código"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="size-4" />
      </ToolBtn>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolBtn
        label="Título 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="size-4" />
      </ToolBtn>
      <ToolBtn
        label="Título 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="size-4" />
      </ToolBtn>
      <ToolBtn
        label="Lista"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </ToolBtn>
      <ToolBtn
        label="Lista numerada"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </ToolBtn>
      <ToolBtn
        label="Citação"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-4" />
      </ToolBtn>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolBtn label="Link" active={editor.isActive("link")} onClick={onAddLink}>
        <LinkIcon className="size-4" />
      </ToolBtn>
      <ToolBtn label="Imagem" onClick={onPickImage}>
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
      </ToolBtn>
      <ToolBtn label="Carrossel de imagens" onClick={onPickGallery}>
        {uploadingGallery ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ImagesIcon className="size-4" />
        )}
      </ToolBtn>
      <ToolBtn label="Vídeo (YouTube/Vimeo)" onClick={onAddYoutube}>
        <YoutubeIcon className="size-4" />
      </ToolBtn>
      <ToolBtn label="Carrossel de vídeos" onClick={onAddVideoCarousel}>
        <Film className="size-4" />
      </ToolBtn>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolBtn label="Desfazer" onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="size-4" />
      </ToolBtn>
      <ToolBtn label="Refazer" onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="size-4" />
      </ToolBtn>
    </div>
  );
}

/**
 * Injeta botões prev/next, dots e autoplay 3s em qualquer `.media-carousel`
 * dentro do editor. Idempotente: marca o elemento com `data-enhanced` para
 * não duplicar controles em re-renders do ProseMirror.
 */
function enhanceEditorCarousels(root: HTMLElement) {
  const carousels = root.querySelectorAll<HTMLElement>(".media-carousel:not([data-enhanced])");
  carousels.forEach((carousel) => {
    const track = carousel.querySelector<HTMLElement>(".media-carousel-track");
    if (!track) return;
    const items = Array.from(track.querySelectorAll<HTMLElement>(".media-carousel-item"));
    if (items.length <= 1) return;
    carousel.setAttribute("data-enhanced", "true");
    const isVideos = carousel.getAttribute("data-type") === "videos";
    const intervalMs = isVideos ? 5000 : 3000;

    // Fundo desfocado: usa a própria imagem por item (aplicado quando carregar)
    if (!isVideos) {
      items.forEach((item) => {
        const img = item.querySelector<HTMLImageElement>("img");
        if (!img) return;
        const setBg = () => {
          if (img.src) item.style.setProperty("--bg-img", `url("${img.src}")`);
        };
        if (img.complete) setBg();
        else img.addEventListener("load", setBg, { once: true });
      });
    }

    const prev = document.createElement("button");
    prev.type = "button";
    prev.contentEditable = "false";
    prev.setAttribute("aria-label", "Slide anterior");
    prev.className = "media-carousel-btn media-carousel-btn-prev";
    prev.innerHTML = "‹";
    const next = document.createElement("button");
    next.type = "button";
    next.contentEditable = "false";
    next.setAttribute("aria-label", "Próximo slide");
    next.className = "media-carousel-btn media-carousel-btn-next";
    next.innerHTML = "›";
    const dots = document.createElement("div");
    dots.contentEditable = "false";
    dots.className = "media-carousel-dots";
    items.forEach((_, i) => {
      const d = document.createElement("button");
      d.type = "button";
      d.contentEditable = "false";
      d.setAttribute("aria-label", `Ir para slide ${i + 1}`);
      d.className = "media-carousel-dot" + (i === 0 ? " is-active" : "");
      d.dataset.index = String(i);
      dots.appendChild(d);
    });
    carousel.appendChild(prev);
    carousel.appendChild(next);
    carousel.appendChild(dots);

    let current = 0;
    const goTo = (i: number, smooth = true) => {
      current = (i + items.length) % items.length;
      const target = items[current];
      track.scrollTo({
        left: target.offsetLeft - track.offsetLeft,
        behavior: smooth ? "smooth" : "auto",
      });
      Array.from(dots.children).forEach((el, idx) => {
        (el as HTMLElement).classList.toggle("is-active", idx === current);
      });
    };

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => goTo(current + 1), intervalMs);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const restart = (fn: () => void) => (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      stop();
      fn();
      start();
    };

    prev.addEventListener("mousedown", (e) => e.preventDefault());
    next.addEventListener("mousedown", (e) => e.preventDefault());
    prev.addEventListener(
      "click",
      restart(() => goTo(current - 1)),
    );
    next.addEventListener(
      "click",
      restart(() => goTo(current + 1)),
    );
    Array.from(dots.children).forEach((el) => {
      el.addEventListener("mousedown", (e) => e.preventDefault());
      el.addEventListener(
        "click",
        restart(() => goTo(Number((el as HTMLElement).dataset.index))),
      );
    });

    carousel.addEventListener("mouseenter", stop);
    carousel.addEventListener("mouseleave", start);

    start();
  });
}
