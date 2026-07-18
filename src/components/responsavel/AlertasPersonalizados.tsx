import { AlertTriangle, TrendingDown, CalendarX, MailWarning, Cake } from "lucide-react";

type Nota = { disciplina: string; bimestre: number; valor: number | null };
type Freq = { data: string; presente: boolean };

export type AlertasInput = {
  nomeAluno: string;
  dataNascimento: string | null;
  notas: Nota[];
  frequencia: Freq[]; // ordem: mais antiga -> mais recente
  comunicadosNaoLidos: { titulo: string; created_at: string }[];
};

type Alerta = {
  tipo: "nota" | "faltas" | "comunicado" | "aniversario";
  titulo: string;
  descricao: string;
  severidade: "info" | "warning" | "danger";
};

export function computarAlertas(input: AlertasInput): Alerta[] {
  const out: Alerta[] = [];

  // Aniversário nos próximos 7 dias (ou hoje)
  if (input.dataNascimento) {
    const dn = new Date(input.dataNascimento);
    const hoje = new Date();
    const prox = new Date(hoje.getFullYear(), dn.getMonth(), dn.getDate());
    if (prox < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) {
      prox.setFullYear(hoje.getFullYear() + 1);
    }
    const dias = Math.round((prox.getTime() - hoje.getTime()) / 864e5);
    if (dias === 0) {
      out.push({
        tipo: "aniversario",
        titulo: `Hoje é aniversário de ${input.nomeAluno}!`,
        descricao: "Toda a equipe da escola deseja um feliz aniversário 🎉",
        severidade: "info",
      });
    } else if (dias > 0 && dias <= 7) {
      out.push({
        tipo: "aniversario",
        titulo: `Aniversário em ${dias} dia${dias > 1 ? "s" : ""}`,
        descricao: `${input.nomeAluno} completa mais um ano em breve 🎂`,
        severidade: "info",
      });
    }
  }

  // Notas abaixo da média (6)
  const baixas = input.notas.filter((n) => n.valor != null && n.valor < 6);
  if (baixas.length > 0) {
    out.push({
      tipo: "nota",
      titulo: `${baixas.length} nota${baixas.length > 1 ? "s" : ""} abaixo da média`,
      descricao: baixas
        .slice(0, 3)
        .map((n) => `${n.disciplina} (${Number(n.valor).toFixed(1)})`)
        .join(", "),
      severidade: baixas.length >= 3 ? "danger" : "warning",
    });
  }

  // 3+ faltas seguidas (mais recentes)
  const ordenadas = [...input.frequencia].sort((a, b) => a.data.localeCompare(b.data));
  let streak = 0;
  let maxStreak = 0;
  for (let i = ordenadas.length - 1; i >= 0; i--) {
    if (!ordenadas[i].presente) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else break;
  }
  if (maxStreak >= 3) {
    out.push({
      tipo: "faltas",
      titulo: `${maxStreak} faltas consecutivas`,
      descricao: "Recomendamos justificar a ausência ou entrar em contato com a coordenação.",
      severidade: "danger",
    });
  }

  // Comunicado não lido há 48h+
  const limite = Date.now() - 48 * 3600 * 1000;
  const antigos = input.comunicadosNaoLidos.filter(
    (c) => new Date(c.created_at).getTime() < limite,
  );
  if (antigos.length > 0) {
    out.push({
      tipo: "comunicado",
      titulo: `${antigos.length} comunicado${antigos.length > 1 ? "s" : ""} não lido${antigos.length > 1 ? "s" : ""} há mais de 48h`,
      descricao: antigos
        .slice(0, 2)
        .map((c) => c.titulo)
        .join(" • "),
      severidade: "warning",
    });
  }

  return out;
}

const ICONS = {
  nota: TrendingDown,
  faltas: CalendarX,
  comunicado: MailWarning,
  aniversario: Cake,
} as const;

const CORES: Record<Alerta["severidade"], string> = {
  info: "border-primary/40 bg-primary/5 text-foreground",
  warning: "border-amber-400/60 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  danger: "border-destructive/60 bg-destructive/10 text-destructive",
};

export function AlertasPersonalizados({ alertas }: { alertas: Alerta[] }) {
  if (alertas.length === 0) return null;
  return (
    <div className="space-y-2">
      {alertas.map((a, i) => {
        const Icon = ICONS[a.tipo] ?? AlertTriangle;
        return (
          <div
            key={i}
            className={`flex gap-3 rounded-xl border p-3 text-sm ${CORES[a.severidade]}`}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold leading-tight">{a.titulo}</p>
              <p className="mt-0.5 text-xs opacity-90">{a.descricao}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
