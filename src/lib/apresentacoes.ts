import { supabase } from "@/integrations/supabase/client";

export type SlideKind =
  | "titulo"
  | "texto"
  | "imagem"
  | "imagemTexto"
  | "citacao"
  | "estatistica";

export type Slide =
  | { id: string; kind: "titulo"; kicker?: string; titulo: string; subtitulo?: string }
  | { id: string; kind: "texto"; titulo?: string; corpo?: string; bullets?: string[] }
  | { id: string; kind: "imagem"; url: string; legenda?: string; alt?: string }
  | {
      id: string;
      kind: "imagemTexto";
      url: string;
      titulo?: string;
      corpo?: string;
      posicao?: "esquerda" | "direita";
    }
  | { id: string; kind: "citacao"; frase: string; autor?: string }
  | {
      id: string;
      kind: "estatistica";
      titulo?: string;
      itens: { valor: string; descricao: string }[];
    };

export type Tema = "institucional" | "escuro" | "claro";
export type Visibilidade = "privada" | "equipe" | "publica";

export type Apresentacao = {
  id: string;
  titulo: string;
  descricao: string | null;
  slides: Slide[];
  tema: Tema;
  visibilidade: Visibilidade;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

const TABLE = "apresentacoes" as const;

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function slideVazio(kind: SlideKind): Slide {
  const id = newId();
  switch (kind) {
    case "titulo":
      return { id, kind, titulo: "Título da apresentação", subtitulo: "" };
    case "texto":
      return { id, kind, titulo: "Novo tópico", bullets: ["Primeiro ponto"] };
    case "imagem":
      return { id, kind, url: "", legenda: "" };
    case "imagemTexto":
      return { id, kind, url: "", titulo: "Título", corpo: "", posicao: "esquerda" };
    case "citacao":
      return { id, kind, frase: "Uma citação inspiradora.", autor: "" };
    case "estatistica":
      return {
        id,
        kind,
        titulo: "Nossos números",
        itens: [
          { valor: "100%", descricao: "Descrição" },
          { valor: "3", descricao: "Descrição" },
        ],
      };
  }
}

/** Import por markdown: `---` separa slides, `#` título, `##` subtítulo, `-` bullet, `![](url)` imagem, `> ` citação. */
export function importarMarkdown(md: string): Slide[] {
  const blocos = md.split(/^---\s*$/m).map((b) => b.trim()).filter(Boolean);
  const out: Slide[] = [];
  for (const bloco of blocos) {
    const linhas = bloco.split("\n").map((l) => l.trim()).filter(Boolean);
    let titulo = "";
    let subtitulo = "";
    const bullets: string[] = [];
    const paragrafos: string[] = [];
    let imagem = "";
    let citacao = "";
    let citacaoAutor = "";
    for (const l of linhas) {
      if (l.startsWith("# ")) titulo = l.slice(2).trim();
      else if (l.startsWith("## ")) subtitulo = l.slice(3).trim();
      else if (l.startsWith("- ")) bullets.push(l.slice(2).trim());
      else if (l.startsWith("> ")) {
        if (!citacao) citacao = l.slice(2).trim();
        else citacaoAutor = l.slice(2).trim().replace(/^—\s*/, "");
      } else {
        const m = l.match(/!\[[^\]]*\]\(([^)]+)\)/);
        if (m) imagem = m[1];
        else paragrafos.push(l);
      }
    }
    if (citacao) {
      out.push({ id: newId(), kind: "citacao", frase: citacao, autor: citacaoAutor });
    } else if (imagem && (titulo || paragrafos.length)) {
      out.push({
        id: newId(),
        kind: "imagemTexto",
        url: imagem,
        titulo,
        corpo: paragrafos.join("\n\n"),
        posicao: "esquerda",
      });
    } else if (imagem) {
      out.push({ id: newId(), kind: "imagem", url: imagem, legenda: paragrafos.join(" ") });
    } else if (bullets.length || paragrafos.length) {
      out.push({
        id: newId(),
        kind: "texto",
        titulo,
        corpo: paragrafos.join("\n\n"),
        bullets: bullets.length ? bullets : undefined,
      });
    } else if (titulo) {
      out.push({ id: newId(), kind: "titulo", titulo, subtitulo });
    }
  }
  return out;
}

export async function listApresentacoes() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, titulo, descricao, tema, visibilidade, owner_id, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Omit<Apresentacao, "slides">[];
}

export async function getApresentacao(id: string): Promise<Apresentacao | null> {
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Apresentacao) ?? null;
}

export async function createApresentacao(titulo = "Nova apresentação") {
  const slides: Slide[] = [
    { id: newId(), kind: "titulo", titulo, subtitulo: "" },
  ];
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ titulo, slides })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateApresentacao(
  id: string,
  patch: Partial<Pick<Apresentacao, "titulo" | "descricao" | "slides" | "tema" | "visibilidade">>,
) {
  const { error } = await supabase.from(TABLE).update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteApresentacao(id: string) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateApresentacao(id: string) {
  const orig = await getApresentacao(id);
  if (!orig) throw new Error("Apresentação não encontrada");
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      titulo: `${orig.titulo} (cópia)`,
      descricao: orig.descricao,
      slides: orig.slides,
      tema: orig.tema,
      visibilidade: "privada",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}