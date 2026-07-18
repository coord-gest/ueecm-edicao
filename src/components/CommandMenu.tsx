import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText,
  Calendar,
  Clock,
  BookOpen,
  Users,
  Home,
  Search,
  ShieldCheck,
  History,
  GraduationCap,
  School,
  Sparkles,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { semanticSearchPosts } from "@/lib/semantic-search.functions";

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const runSemantic = useServerFn(semanticSearchPosts);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  const { data: posts = [] } = useQuery({
    queryKey: ["cmdk-posts"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("id, titulo, turma, disciplina")
        .eq("status", "publicado")
        .order("data", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const trimmed = query.trim();
  const searchEnabled = open && trimmed.length >= 2;

  const { data: alunos = [] } = useQuery({
    queryKey: ["cmdk-alunos", trimmed],
    enabled: searchEnabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("alunos")
        .select("id, nome_completo, matricula, turma_id")
        .or(`nome_completo.ilike.%${trimmed}%,matricula.ilike.%${trimmed}%`)
        .limit(8);
      return data ?? [];
    },
  });

  const { data: turmas = [] } = useQuery({
    queryKey: ["cmdk-turmas", trimmed],
    enabled: searchEnabled,
    queryFn: async () => {
      const { data } = await supabase
        .from("turmas_escolares")
        .select("id, nome, ano_serie")
        .ilike("nome", `%${trimmed}%`)
        .limit(8);
      return data ?? [];
    },
  });

  // Busca semântica (pgvector + Gemini embeddings)
  const { data: semantic = [], isFetching: semanticLoading } = useQuery({
    queryKey: ["cmdk-semantic", trimmed],
    enabled: open && trimmed.length >= 4,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        return await runSemantic({ data: { q: trimmed, limit: 6 } });
      } catch {
        return [];
      }
    },
  });

  const go = (to: string) => {
    setOpen(false);
    setQuery("");
    navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar posts, alunos, turmas, páginas… (Ctrl/⌘+K)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {semanticLoading ? "Buscando com IA…" : "Nenhum resultado encontrado."}
        </CommandEmpty>
        {semantic.length > 0 && (
          <>
            <CommandGroup heading="Resultados inteligentes (IA)">
              {semantic.map((p) => (
                <CommandItem
                  key={`sem-${p.id}`}
                  value={`sem ${p.titulo} ${p.categoria ?? ""} ${p.resumo ?? ""}`}
                  onSelect={() => go(`/posts/${p.slug ?? p.id}`)}
                >
                  <Sparkles className="size-4 text-primary" />
                  <span className="truncate">{p.titulo}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {Math.round(p.similarity * 100)}%
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {searchEnabled && alunos.length > 0 && (
          <>
            <CommandGroup heading="Alunos">
              {alunos.map((a) => (
                <CommandItem
                  key={`aluno-${a.id}`}
                  value={`aluno ${a.nome_completo} ${a.matricula}`}
                  onSelect={() => go("/escola/alunos")}
                >
                  <GraduationCap className="size-4" />
                  <span className="truncate">{a.nome_completo}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {a.matricula}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {searchEnabled && turmas.length > 0 && (
          <>
            <CommandGroup heading="Turmas">
              {turmas.map((t) => (
                <CommandItem
                  key={`turma-${t.id}`}
                  value={`turma ${t.nome} ${t.ano_serie ?? ""}`}
                  onSelect={() => go(`/minhas-turmas/${t.id}` as never)}
                >
                  <School className="size-4" />
                  <span className="truncate">{t.nome}</span>
                  {t.ano_serie && (
                    <span className="ml-auto text-xs text-muted-foreground">{t.ano_serie}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        <CommandGroup heading="Navegação">
          <CommandItem onSelect={() => go("/")}>
            <Home className="size-4" /> Página inicial
          </CommandItem>
          <CommandItem onSelect={() => go("/posts")}>
            <Search className="size-4" /> Todas as publicações
          </CommandItem>
          <CommandItem onSelect={() => go("/calendario")}>
            <Calendar className="size-4" /> Calendário escolar
          </CommandItem>
          <CommandItem onSelect={() => go("/horarios")}>
            <Clock className="size-4" /> Grade de horários
          </CommandItem>
          <CommandItem onSelect={() => go("/painel")}>
            <ShieldCheck className="size-4" /> Painel
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Administração">
          <CommandItem onSelect={() => go("/painel-posts")}>
            <FileText className="size-4" /> Publicações
          </CommandItem>
          <CommandItem onSelect={() => go("/painel-academico")}>
            <BookOpen className="size-4" /> Turmas & Disciplinas
          </CommandItem>
          <CommandItem onSelect={() => go("/usuarios")}>
            <Users className="size-4" /> Usuários
          </CommandItem>
          <CommandItem onSelect={() => go("/painel-auditoria")}>
            <History className="size-4" /> Auditoria
          </CommandItem>
        </CommandGroup>
        {posts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Últimos posts">
              {posts.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.titulo} ${p.turma ?? ""} ${p.disciplina ?? ""}`}
                  onSelect={() => go(`/posts/${p.id}`)}
                >
                  <Search className="size-4" />
                  <span className="truncate">{p.titulo}</span>
                  {p.turma && (
                    <span className="ml-auto text-xs text-muted-foreground">{p.turma}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
