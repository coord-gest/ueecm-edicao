import { Filter, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PostFiltersProps {
  turma: string;
  disciplina: string;
  onTurma: (v: string) => void;
  onDisciplina: (v: string) => void;
  onLimpar: () => void;
}

export function PostFilters({
  turma,
  disciplina,
  onTurma,
  onDisciplina,
  onLimpar,
}: PostFiltersProps) {
  const ativo = turma !== "todas" || disciplina !== "todas";

  const { data: turmas = [], isLoading: loadingTurmas } = useQuery({
    queryKey: ["turmas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("turmas").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: disciplinas = [], isLoading: loadingDiscs } = useQuery({
    queryKey: ["disciplinas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("disciplinas").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const loading = loadingTurmas || loadingDiscs;

  if (loading) {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:flex-row sm:items-end">
        <Skeleton className="h-9 w-full sm:w-48" />
        <Skeleton className="h-9 w-full sm:w-48" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:flex-row sm:items-end">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary sm:mb-2.5">
        <Filter className="size-4" /> Filtro inteligente
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Filtrar por turma</label>
        <Select value={turma} onValueChange={onTurma}>
          <SelectTrigger className="rounded-full">
            <SelectValue placeholder="Todas as turmas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as turmas</SelectItem>
            {turmas.map((t) => (
              <SelectItem key={t.id} value={t.nome}>
                {t.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Filtrar por disciplina</label>
        <Select value={disciplina} onValueChange={onDisciplina}>
          <SelectTrigger className="rounded-full">
            <SelectValue placeholder="Todas as disciplinas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as disciplinas</SelectItem>
            {disciplinas.map((d) => (
              <SelectItem key={d.id} value={d.nome}>
                {d.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ativo && (
        <Button variant="ghost" className="rounded-full sm:mb-0.5" onClick={onLimpar}>
          <X className="size-4" /> Limpar
        </Button>
      )}
    </div>
  );
}
