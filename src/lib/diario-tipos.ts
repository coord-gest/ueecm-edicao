import {
  AlertCircle,
  Eye,
  Hand,
  ThumbsUp,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { DiarioTipo } from "./diario-bordo.functions";

export type DiarioTipoMeta = {
  label: string;
  sugestao: string;
  icon: LucideIcon;
  iconClass: string;
  iconBgClass: string;
  cardClass: string;
  buttonClass: string;
  badgeClass: string;
};

export const TIPO_META: Record<DiarioTipo, DiarioTipoMeta> = {
  elogio: {
    label: "Elogio",
    sugestao: "Excelente desempenho hoje",
    icon: ThumbsUp,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    iconBgClass: "bg-emerald-100 dark:bg-emerald-950/40",
    cardClass: "border-l-4 border-l-emerald-500",
    buttonClass:
      "hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/40",
    badgeClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  participacao: {
    label: "Participação",
    sugestao: "Participou ativamente da aula",
    icon: Hand,
    iconClass: "text-blue-600 dark:text-blue-400",
    iconBgClass: "bg-blue-100 dark:bg-blue-950/40",
    cardClass: "border-l-4 border-l-blue-500",
    buttonClass:
      "hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 dark:hover:bg-blue-950/40",
    badgeClass:
      "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  },
  avanco: {
    label: "Avanço",
    sugestao: "Progresso importante identificado",
    icon: TrendingUp,
    iconClass: "text-purple-600 dark:text-purple-400",
    iconBgClass: "bg-purple-100 dark:bg-purple-950/40",
    cardClass: "border-l-4 border-l-purple-500",
    buttonClass:
      "hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 dark:hover:bg-purple-950/40",
    badgeClass:
      "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  },
  observacao: {
    label: "Observação",
    sugestao: "Observação do dia",
    icon: Eye,
    iconClass: "text-slate-600 dark:text-slate-300",
    iconBgClass: "bg-slate-100 dark:bg-slate-800/60",
    cardClass: "border-l-4 border-l-slate-400",
    buttonClass:
      "hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800/60",
    badgeClass:
      "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200",
  },
  atencao: {
    label: "Atenção",
    sugestao: "Ponto que merece atenção",
    icon: AlertCircle,
    iconClass: "text-amber-600 dark:text-amber-400",
    iconBgClass: "bg-amber-100 dark:bg-amber-950/40",
    cardClass: "border-l-4 border-l-amber-500",
    buttonClass:
      "hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 dark:hover:bg-amber-950/40",
    badgeClass:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  },
};