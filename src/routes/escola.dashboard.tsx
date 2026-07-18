import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Users,
  GraduationCap,
  Megaphone,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Star,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { EscolaShell } from "@/components/escola/EscolaShell";

export const Route = createFileRoute("/escola/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dashboard Escolar" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
  },
  component: DashboardEscolar,
});

// Paleta vibrante com bom contraste em light/dark
const CHART_COLORS = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#3b82f6", // blue
  "#84cc16", // lime
  "#a855f7", // purple
];

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  color: "hsl(var(--foreground))",
  fontSize: 12,
  boxShadow: "0 8px 24px -12px rgba(0,0,0,.25)",
} as const;

const axisTick = { fontSize: 11, fill: "hsl(var(--foreground))" } as const;

function DashboardEscolar() {
  const { data, isLoading } = useQuery({
    queryKey: ["escola-dashboard-v2"],
    queryFn: async () => {
      const now = Date.now();
      const iso30 = new Date(now - 30 * 864e5).toISOString();
      const iso180 = new Date(now - 180 * 864e5).toISOString();

      const [
        turmas,
        alunos,
        responsaveis,
        comunicados30,
        comunicadosSerie,
        notas,
        frequencia,
        agendamentos,
        posts,
        eventos,
        destaques,
        profissionais,
      ] = await Promise.all([
        supabase.from("turmas_escolares").select("id, nome, ano_serie, turno"),
        supabase.from("alunos").select("id, nome_completo, turma_id"),
        supabase.from("responsaveis").select("id", { count: "exact", head: true }),
        supabase
          .from("comunicados")
          .select("id", { count: "exact", head: true })
          .gte("created_at", iso30),
        supabase.from("comunicados").select("created_at").gte("created_at", iso180),
        supabase.from("notas").select("valor, aluno_id, bimestre").not("valor", "is", null),
        supabase.from("frequencia").select("presente, data").gte("data", iso30),
        supabase.from("agendamentos").select("id, status, created_at").gte("created_at", iso180),
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("status", "publicado"),
        supabase
          .from("eventos")
          .select("id", { count: "exact", head: true })
          .gte("data_inicio", new Date().toISOString()),
        supabase.from("alunos_destaque").select("id", { count: "exact", head: true }),
        supabase.from("profissionais").select("id", { count: "exact", head: true }),
      ]);

      // Alunos por turma (ordenado)
      const turmaCount: Record<string, number> = {};
      for (const a of alunos.data ?? []) {
        if (a.turma_id) turmaCount[a.turma_id] = (turmaCount[a.turma_id] ?? 0) + 1;
      }
      const chartTurmas = (turmas.data ?? [])
        .map((t) => ({ nome: t.nome, alunos: turmaCount[t.id] ?? 0 }))
        .sort((a, b) =>
          a.nome.localeCompare(b.nome, "pt-BR", { numeric: true, sensitivity: "base" }),
        );

      // Distribuição por turno
      const turnoMap: Record<string, number> = {};
      for (const t of turmas.data ?? []) {
        const key = (t.turno || "Não definido").toString();
        const count = turmaCount[t.id] ?? 0;
        turnoMap[key] = (turnoMap[key] ?? 0) + count;
      }
      const chartTurnos = Object.entries(turnoMap).map(([name, value]) => ({ name, value }));

      // Comunicados (série mensal últimos 6 meses)
      const monthMap = new Map<string, number>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleDateString("pt-BR", { month: "short" });
        monthMap.set(key, 0);
      }
      for (const c of comunicadosSerie.data ?? []) {
        const d = new Date(c.created_at as string);
        const key = d.toLocaleDateString("pt-BR", { month: "short" });
        if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
      }
      const chartComunicados = Array.from(monthMap, ([mes, total]) => ({ mes, total }));

      // Médias por bimestre
      const bimAgg: Record<string, { soma: number; n: number }> = {};
      for (const n of notas.data ?? []) {
        const b = (n as { bimestre?: number | string | null }).bimestre;
        if (b == null) continue;
        const key = `${b}º Bim`;
        const v = Number((n as { valor: number }).valor);
        if (Number.isFinite(v)) {
          bimAgg[key] ||= { soma: 0, n: 0 };
          bimAgg[key].soma += v;
          bimAgg[key].n += 1;
        }
      }
      const chartMedias = Object.entries(bimAgg)
        .map(([bim, v]) => ({ bim, media: +(v.soma / v.n).toFixed(2) }))
        .sort((a, b) => a.bim.localeCompare(b.bim));

      // Ranking de alunos por média geral (top/bottom)
      const alunoAgg: Record<string, { soma: number; n: number }> = {};
      for (const n of notas.data ?? []) {
        const aid = (n as { aluno_id?: string | null }).aluno_id;
        const v = Number((n as { valor: number }).valor);
        if (!aid || !Number.isFinite(v)) continue;
        alunoAgg[aid] ||= { soma: 0, n: 0 };
        alunoAgg[aid].soma += v;
        alunoAgg[aid].n += 1;
      }
      const alunoNome = new Map<string, string>();
      for (const a of alunos.data ?? []) {
        if (a.id) alunoNome.set(a.id, (a.nome_completo || "—").toString());
      }
      const rankingAlunos = Object.entries(alunoAgg)
        .filter(([, v]) => v.n >= 2)
        .map(([id, v]) => ({
          nome: (alunoNome.get(id) || "—").split(" ").slice(0, 2).join(" "),
          media: +(v.soma / v.n).toFixed(2),
        }))
        .sort((a, b) => b.media - a.media);
      const topAlunos = rankingAlunos.slice(0, 10);
      const bottomAlunos = rankingAlunos.slice(-10).reverse();

      // Frequência 30d
      let pres = 0;
      let falt = 0;
      for (const f of frequencia.data ?? []) {
        if (f.presente) pres++;
        else falt++;
      }
      const totalFreq = pres + falt;
      const taxaPresenca = totalFreq ? +((pres / totalFreq) * 100).toFixed(1) : 0;

      // Agendamentos por status
      const agStatus: Record<string, number> = {};
      for (const a of agendamentos.data ?? []) {
        const s = (a.status || "pendente").toString();
        agStatus[s] = (agStatus[s] ?? 0) + 1;
      }
      const chartAgendamentos = Object.entries(agStatus).map(([name, value]) => ({ name, value }));

      return {
        totalTurmas: turmas.data?.length ?? 0,
        totalAlunos: alunos.data?.length ?? 0,
        totalResponsaveis: responsaveis.count ?? 0,
        comunicados30d: comunicados30.count ?? 0,
        totalPosts: posts.count ?? 0,
        eventosFuturos: eventos.count ?? 0,
        totalDestaques: destaques.count ?? 0,
        totalProfissionais: profissionais.count ?? 0,
        taxaPresenca,
        totalAgendamentos: agendamentos.data?.length ?? 0,
        chartTurmas,
        chartTurnos,
        chartComunicados,
        chartMedias,
        chartAgendamentos,
        topAlunos,
        bottomAlunos,
      };
    },
  });

  if (isLoading || !data) {
    return (
      <EscolaShell title="Dashboard escolar" description="Visão geral em tempo real">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      </EscolaShell>
    );
  }

  return (
    <EscolaShell title="Dashboard escolar" description="Visão geral em tempo real">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<BookOpen className="size-5" />}
          label="Turmas"
          value={data.totalTurmas}
          tint="#6366f1"
        />
        <Kpi
          icon={<GraduationCap className="size-5" />}
          label="Alunos"
          value={data.totalAlunos}
          tint="#10b981"
        />
        <Kpi
          icon={<Users className="size-5" />}
          label="Responsáveis"
          value={data.totalResponsaveis}
          tint="#f59e0b"
        />
        <Kpi
          icon={<Megaphone className="size-5" />}
          label="Comunicados (30d)"
          value={data.comunicados30d}
          tint="#ec4899"
        />
        <Kpi
          icon={<UserCheck className="size-5" />}
          label="Presença 30d"
          value={`${data.taxaPresenca}%`}
          tint="#14b8a6"
        />
        <Kpi
          icon={<CalendarDays className="size-5" />}
          label="Eventos futuros"
          value={data.eventosFuturos}
          tint="#8b5cf6"
        />
        <Kpi
          icon={<FileText className="size-5" />}
          label="Publicações"
          value={data.totalPosts}
          tint="#06b6d4"
        />
        <Kpi
          icon={<Star className="size-5" />}
          label="Alunos em destaque"
          value={data.totalDestaques}
          tint="#f97316"
        />
      </div>

      {/* Charts grid */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Alunos por turma */}
        <ChartCard
          title="Alunos por turma"
          subtitle="Distribuição atual"
          action={{ to: "/escola/turmas", label: "Ver turmas" }}
        >
          <BarChart data={data.chartTurmas} margin={{ top: 8, right: 8, left: -12, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="nome"
              tick={axisTick}
              interval={0}
              angle={-90}
              textAnchor="end"
              height={90}
            />

            <YAxis allowDecimals={false} tick={axisTick} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
            />
            <Bar dataKey="alunos" radius={[8, 8, 0, 0]}>
              {data.chartTurmas.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        {/* Comunicados por mês */}
        <ChartCard
          title="Comunicados nos últimos 6 meses"
          subtitle="Volume mensal de envios"
          action={{ to: "/escola/comunicados", label: "Ver comunicados" }}
        >
          <AreaChart
            data={data.chartComunicados}
            margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
          >
            <defs>
              <linearGradient id="gradComunicados" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ec4899" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#ec4899" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" tick={axisTick} />
            <YAxis allowDecimals={false} tick={axisTick} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#ec4899"
              strokeWidth={2.5}
              fill="url(#gradComunicados)"
            />
          </AreaChart>
        </ChartCard>

        {/* Distribuição por turno */}
        <ChartCard title="Distribuição por turno" subtitle="Alunos por período">
          <PieChart>
            <Pie
              data={data.chartTurnos}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={3}
              label={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
            >
              {data.chartTurnos.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartCard>

        {/* Médias por bimestre */}
        {data.chartMedias.length > 0 && (
          <ChartCard
            title="Média geral por bimestre"
            subtitle="Desempenho consolidado"
            action={{ to: "/painel-academico", label: "Acadêmico" }}
          >
            <LineChart data={data.chartMedias} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="bim" tick={axisTick} />
              <YAxis domain={[0, 10]} tick={axisTick} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="media"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 5, fill: "#10b981" }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ChartCard>
        )}

        {/* Taxa de presença radial */}
        <ChartCard title="Taxa de presença (30d)" subtitle="Frequência escolar recente">
          <RadialBarChart
            data={[{ name: "Presença", value: data.taxaPresenca, fill: "#14b8a6" }]}
            innerRadius="65%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar background dataKey="value" cornerRadius={12} />
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-foreground"
              style={{ fontSize: 32, fontWeight: 700 }}
            >
              {data.taxaPresenca}%
            </text>
            <Tooltip contentStyle={tooltipStyle} />
          </RadialBarChart>
        </ChartCard>

        {/* Agendamentos por status */}
        {data.chartAgendamentos.length > 0 && (
          <ChartCard
            title="Agendamentos por status"
            subtitle="Últimos 6 meses"
            action={{ to: "/painel-agendamentos", label: "Ver agendamentos" }}
          >
            <BarChart
              data={data.chartAgendamentos}
              margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={axisTick} />
              <YAxis allowDecimals={false} tick={axisTick} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {data.chartAgendamentos.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ChartCard>
        )}

        {/* Top 10 alunos por média */}
        {data.topAlunos.length > 0 && (
          <ChartCard
            title="Top 10 — maiores médias"
            subtitle="Candidatos naturais a destaque do mês"
            action={{ to: "/painel-alunos-destaque", label: "Alunos em destaque" }}
          >
            <BarChart
              data={data.topAlunos}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 10]} tick={axisTick} />
              <YAxis type="category" dataKey="nome" tick={axisTick} width={110} interval={0} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
              />
              <Bar dataKey="media" radius={[0, 8, 8, 0]}>
                {data.topAlunos.map((_, i) => (
                  <Cell key={i} fill="#10b981" />
                ))}
              </Bar>
            </BarChart>
          </ChartCard>
        )}

        {/* Bottom 10 alunos por média */}
        {data.bottomAlunos.length > 0 && (
          <ChartCard
            title="10 menores médias"
            subtitle="Alunos que podem precisar de acompanhamento"
            action={{ to: "/painel-academico", label: "Acompanhar" }}
          >
            <BarChart
              data={data.bottomAlunos}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 10]} tick={axisTick} />
              <YAxis type="category" dataKey="nome" tick={axisTick} width={110} interval={0} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }}
              />
              <Bar dataKey="media" radius={[0, 8, 8, 0]}>
                {data.bottomAlunos.map((_, i) => (
                  <Cell key={i} fill="#ef4444" />
                ))}
              </Bar>
            </BarChart>
          </ChartCard>
        )}
      </div>

      {/* Atalhos para relatórios */}
      <section className="mt-6 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Relatórios e ferramentas</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ReportLink
            to="/painel-analytics"
            icon={<TrendingUp className="size-4" />}
            title="Analytics do site"
            desc="Páginas, sessões e eventos"
          />
          <ReportLink
            to="/painel-academico"
            icon={<GraduationCap className="size-4" />}
            title="Relatório acadêmico"
            desc="Notas, boletins e disciplinas"
          />
          <ReportLink
            to="/escola/comunicados/dashboard"
            icon={<Megaphone className="size-4" />}
            title="Analytics de comunicados"
            desc="Leitura e engajamento"
          />
          <ReportLink
            to="/painel-agendamentos"
            icon={<ClipboardCheck className="size-4" />}
            title="Agendamentos"
            desc="Reuniões e status"
          />
          <ReportLink
            to="/painel-auditoria"
            icon={<FileText className="size-4" />}
            title="Auditoria"
            desc="Trilha de alterações"
          />
          <ReportLink
            to="/painel-arquivos"
            icon={<FileText className="size-4" />}
            title="Arquivos"
            desc="Modelos e preenchimentos"
          />
        </div>
      </section>
    </EscolaShell>
  );
}

function Kpi({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tint?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition hover:shadow-md">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: tint ?? "hsl(var(--primary))" }}
      />
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm font-medium">{label}</span>
        <span
          className="grid size-9 place-items-center rounded-lg"
          style={{ background: `${tint ?? "#6366f1"}1a`, color: tint ?? "#6366f1" }}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: { to: string; label: string };
  children: React.ReactElement;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action && (
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link to={action.to}>
              {action.label} <ArrowRight className="size-4" />
            </Link>
          </Button>
        )}
      </div>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ReportLink({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-xl border border-border/70 bg-background p-4 transition hover:border-primary/50 hover:bg-primary/5"
    >
      <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="flex-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
    </Link>
  );
}
