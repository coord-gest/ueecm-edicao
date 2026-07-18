import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Loader2,
  Sprout,
  Trash2,
  GraduationCap,
  CalendarRange,
  Clock3,
  RefreshCw,
  CheckCircle2,
  Users,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { SEED_AUTHOR_TAG, SEED_POSTS } from "@/lib/seed-posts";
import {
  SEED_TURMA_NAMES,
  SEED_DISCIPLINA_NAMES,
  SEED_PROFESSORES,
  SEED_EVENTOS,
  SEED_EVENTO_TAG,
  SEED_TURMA_TURNO,
  SEED_TURMA_DISCIPLINAS,
  SEED_FAIXAS,
} from "@/lib/seed-academic";
import { seedSchoolUsers, wipeSchoolUsers, SEED_USER_PLAN } from "@/lib/seed-users.functions";
import { SEED_PROFISSIONAIS, SEED_PROFISSIONAL_EMAIL_DOMAIN } from "@/lib/seed-profissionais";
import { logger } from "@/lib/logger";

type SeedSummary = { label: string; created: number; at: string };

export function SeedAcademicCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [history, setHistory] = useState<SeedSummary[]>([]);

  const log = (label: string, created: number) =>
    setHistory((h) =>
      [{ label, created, at: new Date().toLocaleTimeString("pt-BR") }, ...h].slice(0, 10),
    );

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["painel-stats"] });
    qc.invalidateQueries({ queryKey: ["painel-posts"] });
    qc.invalidateQueries({ queryKey: ["home-posts"] });
    qc.invalidateQueries({ queryKey: ["school-users"] });
    qc.invalidateQueries({ queryKey: ["turmas"] });
    qc.invalidateQueries({ queryKey: ["disciplinas"] });
    qc.invalidateQueries({ queryKey: ["eventos"] });
    qc.invalidateQueries({ queryKey: ["horarios"] });
    qc.invalidateQueries({ queryKey: ["profissionais"] });
  };

  // ---------- Turmas + Disciplinas ----------
  const seedAcademic = useMutation({
    mutationFn: async () => {
      const slugify = (s: string) =>
        s
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      // Prefixo "seed-" no slug garante isolamento total: registros reais
      // com mesmo nome NUNCA são tocados (criação ou remoção).
      const turmaRows = SEED_TURMA_NAMES.map((nome) => ({ nome, slug: `seed-${slugify(nome)}` }));
      const discRows = SEED_DISCIPLINA_NAMES.map((nome) => ({
        nome,
        slug: `seed-${slugify(nome)}`,
      }));
      const [t, d] = await Promise.all([
        supabase
          .from("turmas")
          .upsert(turmaRows, { onConflict: "slug", ignoreDuplicates: true })
          .select("id, nome"),
        supabase
          .from("disciplinas")
          .upsert(discRows, { onConflict: "slug", ignoreDuplicates: true })
          .select("id, nome"),
      ]);
      if (t.error) throw t.error;
      if (d.error) throw d.error;
      return { turmas: turmaRows.length, disciplinas: discRows.length };
    },

    onSuccess: ({ turmas, disciplinas }) => {
      toast.success(`Turmas e disciplinas criadas`, {
        description: `${turmas} turmas, ${disciplinas} disciplinas`,
      });
      log("Turmas + Disciplinas", turmas + disciplinas);
      invalidateAll();
    },
    onError: (e: unknown) =>
      toast.error("Erro", { description: e instanceof Error ? e.message : undefined }),
  });

  // ---------- Eventos ----------
  const seedEventos = useMutation({
    mutationFn: async () => {
      // Limpa apenas eventos marcados antes de inserir (idempotente)
      await supabase.from("eventos").delete().like("descricao", `%${SEED_EVENTO_TAG}%`);
      const now = Date.now();
      const rows = SEED_EVENTOS.map((e) => {
        const inicio = new Date(now + e.diasAteOcorrer * 86_400_000);
        inicio.setHours(9, 0, 0, 0);
        const fim = new Date(inicio.getTime() + e.duracaoHoras * 3_600_000);
        return {
          titulo: e.titulo,
          descricao: `${e.descricao} ${SEED_EVENTO_TAG}`,
          tipo: e.tipo,
          local: e.local,
          turma: e.turma,
          data_inicio: inicio.toISOString(),
          data_fim: fim.toISOString(),
        };
      });
      const { error } = await supabase.from("eventos").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} eventos criados`);
      log("Eventos", n);
      invalidateAll();
    },
    onError: (e: unknown) =>
      toast.error("Erro", { description: e instanceof Error ? e.message : undefined }),
  });

  // ---------- Horários ----------
  const seedHorarios = useMutation({
    mutationFn: async () => {
      const [t, d] = await Promise.all([
        supabase.from("turmas").select("id, nome, slug").like("slug", "seed-%"),
        supabase.from("disciplinas").select("id, nome, slug").like("slug", "seed-%"),
      ]);
      if (t.error) throw t.error;
      if (d.error) throw d.error;
      const turmas = t.data ?? [];
      const discs = d.data ?? [];
      if (turmas.length === 0 || discs.length === 0) {
        throw new Error("Crie primeiro turmas e disciplinas (seed).");
      }
      const discMap = new Map(discs.map((x) => [x.nome, x.id]));

      // Limpa horários das turmas seed antes de regravar (idempotente por turma)
      const targetIds = turmas.map((x) => x.id);
      if (targetIds.length) {
        await supabase.from("horarios").delete().in("turma_id", targetIds);
      }

      const rows: Array<{
        turma_id: string;
        disciplina_id: string;
        professor: string;
        dia_semana: number;
        turno: string;
        hora_inicio: string;
        hora_fim: string;
        ordem: number;
      }> = [];

      for (const turma of turmas) {
        const turno = SEED_TURMA_TURNO[turma.nome];
        const palette = SEED_TURMA_DISCIPLINAS[turma.nome];
        if (!turno || !palette) continue;
        const faixas = SEED_FAIXAS[turno];
        let cursor = 0;
        for (let dia = 1; dia <= 5; dia++) {
          for (let i = 0; i < faixas.length; i++) {
            const discName = palette[cursor % palette.length];
            cursor++;
            const discId = discMap.get(discName);
            if (!discId) continue;
            rows.push({
              turma_id: turma.id,
              disciplina_id: discId,
              professor: SEED_PROFESSORES[discName] ?? "Professor(a)",
              dia_semana: dia,
              turno,
              hora_inicio: faixas[i].hora_inicio,
              hora_fim: faixas[i].hora_fim,
              ordem: i + 1,
            });
          }
        }
      }

      // Insere em lotes para evitar payload gigante
      const chunkSize = 200;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const { error } = await supabase.from("horarios").insert(rows.slice(i, i + chunkSize));
        if (error) throw error;
      }
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} aulas geradas na grade`);
      log("Horários", n);
      invalidateAll();
    },
    onError: (e: unknown) =>
      toast.error("Erro", { description: e instanceof Error ? e.message : undefined }),
  });

  // ---------- Posts: gerar + regenerar ----------
  const insertPosts = async () => {
    const now = Date.now();
    const rows = SEED_POSTS.map((p) => {
      const data = new Date(now - p.diasAtras * 86_400_000).toISOString();
      return {
        titulo: p.titulo,
        resumo: p.resumo,
        conteudo: p.conteudo,
        imagem: p.imagem,
        autor: p.autor,
        autor_id: user?.id,
        turma: p.turma,
        disciplina: p.disciplina,
        destaque: p.destaque,
        geral: p.geral,
        status: "publicado" as const,
        aprovado_por: user?.id,
        aprovado_em: data,
        data,
      };
    });
    const { error } = await supabase.from("posts").insert(rows);
    if (error) throw error;
    return rows.length;
  };

  const seedPosts = useMutation({
    mutationFn: insertPosts,
    onSuccess: (n) => {
      toast.success(`${n} posts criados`);
      log("Posts", n);
      invalidateAll();
    },
    onError: (e: unknown) =>
      toast.error("Erro", { description: e instanceof Error ? e.message : undefined }),
  });

  const regenPosts = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("posts").delete().like("autor", `${SEED_AUTHOR_TAG}%`);
      if (error) throw error;
      return await insertPosts();
    },
    onSuccess: (n) => {
      toast.success(`Posts regenerados`, { description: `${n} posts atualizados` });
      log("Posts (regen)", n);
      invalidateAll();
    },
    onError: (e: unknown) =>
      toast.error("Erro", { description: e instanceof Error ? e.message : undefined }),
  });

  // ---------- Usuários demo ----------
  const seedUsersFn = useServerFn(seedSchoolUsers);
  const wipeUsersFn = useServerFn(wipeSchoolUsers);
  const totalUsers = SEED_USER_PLAN.reduce((a, p) => a + p.count, 0);

  const seedUsers = useMutation({
    mutationFn: () => seedUsersFn({}),
    onSuccess: (r) => {
      const total = r.created + r.skipped;
      toast.success(`Usuários demo prontos`, {
        description: `${r.created} criados, ${r.skipped} já existiam${
          r.errors.length ? ` — ${r.errors.length} erros` : ""
        }`,
      });
      log("Usuários demo", total);
      qc.removeQueries({ queryKey: ["school-users"] });
      invalidateAll();
      if (r.errors.length) logger.warn("[seed users] erros:", r.errors);
    },
    onError: (e: unknown) =>
      toast.error("Erro ao criar usuários", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  const wipeUsers = useMutation({
    mutationFn: () => wipeUsersFn({ data: { confirm: true } }),
    onSuccess: (r) => {
      toast.success(`${r.deleted} usuários demo removidos`);
      log("Usuários demo (limpeza)", r.deleted);
      qc.removeQueries({ queryKey: ["school-users"] });
      invalidateAll();
      if (r.errors.length) logger.warn("[wipe users] erros:", r.errors);
    },
    onError: (e: unknown) =>
      toast.error("Erro ao remover usuários", {
        description: e instanceof Error ? e.message : undefined,
      }),
  });

  // ---------- Profissionais da Educação ----------
  const seedProfissionais = useMutation({
    mutationFn: async () => {
      const rows = SEED_PROFISSIONAIS.map((p) => ({
        nome: p.nome,
        cargo: p.cargo,
        cargo_descricao: p.cargo_descricao ?? null,
        email: p.email,
        telefone: p.telefone ?? null,
        formacao: p.formacao ?? null,
        bio: p.bio ?? null,
        disciplinas: p.disciplinas ?? [],
        anos_experiencia: p.anos_experiencia ?? null,
        ano_ingresso: p.ano_ingresso ?? null,
        destaque: p.destaque ?? false,
        ordem: p.ordem ?? 0,
        ativo: true,
        created_by: user?.id ?? null,
      }));
      // Idempotente: remove os profissionais demo antes de regravar
      await supabase
        .from("profissionais")
        .delete()
        .like("email", `%@${SEED_PROFISSIONAL_EMAIL_DOMAIN}`);
      const { error } = await supabase.from("profissionais").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} profissionais criados`);
      log("Profissionais", n);
      invalidateAll();
    },
    onError: (e: unknown) =>
      toast.error("Erro", { description: e instanceof Error ? e.message : undefined }),
  });

  const wipeProfissionais = useMutation({
    mutationFn: async () => {
      const { error, count } = await supabase
        .from("profissionais")
        .delete({ count: "exact" })
        .like("email", `%@${SEED_PROFISSIONAL_EMAIL_DOMAIN}`);
      if (error) throw error;
      return count ?? 0;
    },
    onSuccess: (n) => {
      toast.success(`${n} profissionais removidos`);
      log("Profissionais (limpeza)", n);
      invalidateAll();
    },
    onError: (e: unknown) =>
      toast.error("Erro", { description: e instanceof Error ? e.message : undefined }),
  });

  const wipeAll = useMutation({
    mutationFn: async () => {
      // 1) Horários das turmas seed (deve vir antes de remover as turmas).
      // Isolamento por slug "seed-%" — registros reais homônimos NÃO são tocados.
      const turmasSeed =
        (await supabase.from("turmas").select("id").like("slug", "seed-%")).data ?? [];
      const turmaIds = turmasSeed.map((x) => x.id);
      const h = turmaIds.length
        ? await supabase.from("horarios").delete({ count: "exact" }).in("turma_id", turmaIds)
        : { count: 0, error: null as null };
      if (h.error) throw h.error;

      const [p, e, prof, tur, dis, usr] = await Promise.all([
        supabase.from("posts").delete({ count: "exact" }).like("autor", `${SEED_AUTHOR_TAG}%`),
        supabase
          .from("eventos")
          .delete({ count: "exact" })
          .like("descricao", `%${SEED_EVENTO_TAG}%`),
        supabase
          .from("profissionais")
          .delete({ count: "exact" })
          .like("email", `%@${SEED_PROFISSIONAL_EMAIL_DOMAIN}`),
        turmaIds.length
          ? supabase.from("turmas").delete({ count: "exact" }).in("id", turmaIds)
          : Promise.resolve({ count: 0, error: null as null }),
        supabase.from("disciplinas").delete({ count: "exact" }).like("slug", "seed-%"),
        wipeUsersFn({ data: { confirm: true } }).catch((err: unknown) => {
          logger.warn("[wipeAll users]", err);
          return { deleted: 0, errors: [String(err)] };
        }),
      ]);
      if (p.error) throw p.error;
      if (e.error) throw e.error;
      if (prof.error) throw prof.error;
      if (tur.error) throw tur.error;
      if (dis.error) throw dis.error;
      return {
        posts: p.count ?? 0,
        eventos: e.count ?? 0,
        horarios: h.count ?? 0,
        profissionais: prof.count ?? 0,
        turmas: tur.count ?? 0,
        disciplinas: dis.count ?? 0,
        usuarios: usr.deleted ?? 0,
      };
    },
    onSuccess: (r) => {
      toast.success("Seeds removidos", {
        description: `${r.posts} posts · ${r.eventos} eventos · ${r.horarios} horários · ${r.profissionais} profissionais · ${r.turmas} turmas · ${r.disciplinas} disciplinas · ${r.usuarios} usuários`,
      });
      log(
        "Limpeza geral",
        r.posts + r.eventos + r.horarios + r.profissionais + r.turmas + r.disciplinas + r.usuarios,
      );
      invalidateAll();
    },
    onError: (e: unknown) =>
      toast.error("Erro", { description: e instanceof Error ? e.message : undefined }),
  });

  const busy =
    seedAcademic.isPending ||
    seedEventos.isPending ||
    seedHorarios.isPending ||
    seedPosts.isPending ||
    regenPosts.isPending ||
    seedUsers.isPending ||
    wipeUsers.isPending ||
    seedProfissionais.isPending ||
    wipeProfissionais.isPending ||
    wipeAll.isPending;

  return (
    <div className="mt-6 rounded-3xl border border-accent/40 bg-accent/5 p-6 shadow-sm">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        <Database className="size-5 text-accent-foreground" /> Seeds de dados (Desenvolvedor)
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Popule o sistema com dados acadêmicos fictícios profissionais. Usuários e configurações
        reais não são afetados — apenas registros marcados como seed são manipulados.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <SeedRow
          icon={GraduationCap}
          title={`Turmas + Disciplinas (${SEED_TURMA_NAMES.length}/${SEED_DISCIPLINA_NAMES.length})`}
          description="Cria turmas e disciplinas base, base para horários e posts."
          actionLabel="Gerar"
          onAction={() => seedAcademic.mutate()}
          pending={seedAcademic.isPending}
          disabled={busy}
        />
        <SeedRow
          icon={CalendarRange}
          title={`Eventos do calendário (${SEED_EVENTOS.length})`}
          description="Tipos variados (acadêmico, cultural, esportivo, reunião, feriado), datas escalonadas e turmas vinculadas."
          actionLabel="Gerar"
          onAction={() => seedEventos.mutate()}
          pending={seedEventos.isPending}
          disabled={busy}
        />
        <SeedRow
          icon={Clock3}
          title="Grade de horários semanal"
          description="5 aulas/dia × 5 dias × 8 turmas, com turnos, professores e disciplinas vinculadas."
          actionLabel="Gerar"
          onAction={() => seedHorarios.mutate()}
          pending={seedHorarios.isPending}
          disabled={busy}
        />
        <SeedRow
          icon={Sprout}
          title={`Posts publicados (${SEED_POSTS.length})`}
          description="Posts profissionais com capa, autor e datas escalonadas."
          actionLabel="Gerar"
          onAction={() => seedPosts.mutate()}
          pending={seedPosts.isPending}
          disabled={busy}
          secondary={{
            label: "Regenerar",
            icon: RefreshCw,
            onClick: () => regenPosts.mutate(),
            pending: regenPosts.isPending,
          }}
        />
        <SeedRow
          icon={Users}
          title={`Usuários demo (${totalUsers})`}
          description={`${SEED_USER_PLAN.map((p) => `${p.count} ${p.label.toLowerCase()}s`).join(", ")}. Senha definida no servidor (peça ao desenvolvedor).`}
          actionLabel="Gerar"
          onAction={() => {
            if (
              confirm(
                `Criar ${totalUsers} usuários demo? E-mails seguem o padrão seed.<cargo>.<n>@escola.demo e podem ser removidos a qualquer momento.`,
              )
            )
              seedUsers.mutate();
          }}
          pending={seedUsers.isPending}
          disabled={busy}
          secondary={{
            label: "Remover",
            icon: Trash2,
            onClick: () => {
              if (confirm("Remover TODOS os usuários demo (@escola.demo)?")) wipeUsers.mutate();
            },
            pending: wipeUsers.isPending,
          }}
        />
        <SeedRow
          icon={UserCog}
          title={`Profissionais da educação (${SEED_PROFISSIONAIS.length})`}
          description="Diretoria, coordenação, professores, secretaria e demais profissionais com nome, cargo, formação, contato, experiência e bio."
          actionLabel="Gerar"
          onAction={() => seedProfissionais.mutate()}
          pending={seedProfissionais.isPending}
          disabled={busy}
          secondary={{
            label: "Remover",
            icon: Trash2,
            onClick: () => {
              if (confirm("Remover TODOS os profissionais demo (@escola.demo)?"))
                wipeProfissionais.mutate();
            },
            pending: wipeProfissionais.isPending,
          }}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <p className="text-xs text-muted-foreground">
          A limpeza remove apenas registros marcados como seed.
        </p>
        <Button
          variant="outline"
          className="rounded-full"
          disabled={busy}
          onClick={() => {
            if (
              confirm(
                "Remover TODOS os dados de seed (posts, eventos, horários, turmas, disciplinas, profissionais e usuários demo)?",
              )
            )
              wipeAll.mutate();
          }}
        >
          {wipeAll.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          Limpar todos os seeds
        </Button>
      </div>

      {history.length > 0 && (
        <div className="mt-5 rounded-2xl border border-border/60 bg-background/60 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-accent-foreground" /> Resumo desta sessão
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-foreground">
                <span>
                  <strong>{h.label}</strong> — {h.created} registros
                </span>
                <span className="text-xs text-muted-foreground">{h.at}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SeedRow({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  pending,
  disabled,
  secondary,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  pending: boolean;
  disabled: boolean;
  secondary?: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    pending: boolean;
  };
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" className="rounded-full" onClick={onAction} disabled={disabled}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sprout className="size-4" />}
          {actionLabel}
        </Button>
        {secondary && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={secondary.onClick}
            disabled={disabled}
          >
            {secondary.pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <secondary.icon className="size-4" />
            )}
            {secondary.label}
          </Button>
        )}
      </div>
    </div>
  );
}
