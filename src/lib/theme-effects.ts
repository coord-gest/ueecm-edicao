import { supabase } from "@/integrations/supabase/client";

// ============= Imagens 3D realistas (PNG transparente) =============
// Festa Junina
import juninaBandeirinha from "@/assets/theme/junina-bandeirinha.png";
import juninaMilho from "@/assets/theme/junina-milho.png";
import juninaFogueira from "@/assets/theme/junina-fogueira.png";
import juninaChapeu from "@/assets/theme/junina-chapeu.png";
import juninaBalao from "@/assets/theme/junina-balao.png";
// São João
import saojoaoBalao from "@/assets/theme/saojoao-balao.png";
import saojoaoSanfona from "@/assets/theme/saojoao-sanfona.png";
import saojoaoAmendoim from "@/assets/theme/saojoao-amendoim.png";
import saojoaoPedemoleque from "@/assets/theme/saojoao-pedemoleque.png";
// Natal
import natalArvore from "@/assets/theme/natal-arvore.png";
import natalPresente from "@/assets/theme/natal-presente.png";
import natalFloco from "@/assets/theme/natal-floco.png";
import natalGorro from "@/assets/theme/natal-gorro.png";
// Carnaval
import carnavalMascara from "@/assets/theme/carnaval-mascara.png";
import carnavalPinata from "@/assets/theme/carnaval-pinata.png";
import carnavalConfete from "@/assets/theme/carnaval-confete.png";
import carnavalChocalho from "@/assets/theme/carnaval-chocalho.png";
// Halloween
import halloweenAbobora from "@/assets/theme/halloween-abobora.png";
import halloweenFantasma from "@/assets/theme/halloween-fantasma.png";
import halloweenMorcego from "@/assets/theme/halloween-morcego.png";
import halloweenDoce from "@/assets/theme/halloween-doce.png";
// Páscoa
import pascoaCoelho from "@/assets/theme/pascoa-coelho.png";
import pascoaOvo from "@/assets/theme/pascoa-ovo.png";
import pascoaChocolate from "@/assets/theme/pascoa-chocolate.png";
import pascoaPintinho from "@/assets/theme/pascoa-pintinho.png";
// Primavera
import primaveraFlor from "@/assets/theme/primavera-flor.png";
import primaveraBorboleta from "@/assets/theme/primavera-borboleta.png";
import primaveraTulipa from "@/assets/theme/primavera-tulipa.png";
import primaveraFolha from "@/assets/theme/primavera-folha.png";
// Aniversário
import aniversarioBolo from "@/assets/theme/aniversario-bolo.png";
import aniversarioBalao from "@/assets/theme/aniversario-balao.png";
import aniversarioChapeu from "@/assets/theme/aniversario-chapeu.png";
import aniversarioPresente from "@/assets/theme/aniversario-presente.png";
// Dia do Professor
import professorMaca from "@/assets/theme/professor-maca.png";
import professorLivros from "@/assets/theme/professor-livros.png";
import professorLapis from "@/assets/theme/professor-lapis.png";
import professorFormatura from "@/assets/theme/professor-formatura.png";
// 7 de Setembro
import seteBandeira from "@/assets/theme/setesetembro-bandeira.png";
import seteEstrela from "@/assets/theme/setesetembro-estrela.png";
import seteTrompete from "@/assets/theme/setesetembro-trompete.png";
import seteMedalha from "@/assets/theme/setesetembro-medalha.png";
// Dia das Crianças
import criancasUrso from "@/assets/theme/criancas-urso.png";
import criancasPipa from "@/assets/theme/criancas-pipa.png";
import criancasPirulito from "@/assets/theme/criancas-pirulito.png";
import criancasCarrinho from "@/assets/theme/criancas-carrinho.png";
// Dia das Mães
import maesBuque from "@/assets/theme/maes-buque.png";
import maesCoracao from "@/assets/theme/maes-coracao.png";
import maesRosa from "@/assets/theme/maes-rosa.png";
import maesPresente from "@/assets/theme/maes-presente.png";
// Dia dos Pais
import paisGravata from "@/assets/theme/pais-gravata.png";
import paisRelogio from "@/assets/theme/pais-relogio.png";
import paisBigode from "@/assets/theme/pais-bigode.png";
import paisCaneca from "@/assets/theme/pais-caneca.png";
// Volta às Aulas
import aulasMochila from "@/assets/theme/aulas-mochila.png";
import aulasCaderno from "@/assets/theme/aulas-caderno.png";
import aulasGiz from "@/assets/theme/aulas-giz.png";
import aulasSino from "@/assets/theme/aulas-sino.png";
// Formatura
import formaturaDiploma from "@/assets/theme/formatura-diploma.png";
import formaturaCapelo from "@/assets/theme/formatura-capelo.png";
import formaturaTrofeu from "@/assets/theme/formatura-trofeu.png";
import formaturaLoureiro from "@/assets/theme/formatura-loureiro.png";
// Consciência Negra
import conscienciaPunho from "@/assets/theme/consciencia-punho.png";
import conscienciaPomba from "@/assets/theme/consciencia-pomba.png";
import conscienciaGlobo from "@/assets/theme/consciencia-globo.png";
import conscienciaLivro from "@/assets/theme/consciencia-livro.png";
// Dia do Estudante
import estudanteLampada from "@/assets/theme/estudante-lampada.png";
import estudanteLivros from "@/assets/theme/estudante-livros.png";
import estudanteLapis from "@/assets/theme/estudante-lapis.png";
import estudanteMaca from "@/assets/theme/estudante-maca.png";
// Outubro Rosa
import outubroLaco from "@/assets/theme/outubrorosa-laco.png";
import outubroFlor from "@/assets/theme/outubrorosa-flor.png";
import outubroCoracao from "@/assets/theme/outubrorosa-coracao.png";
import outubroTulipa from "@/assets/theme/outubrorosa-tulipa.png";
// Novembro Azul
import novembroLaco from "@/assets/theme/novembroazul-laco.png";
import novembroEstetoscopio from "@/assets/theme/novembroazul-estetoscopio.png";
import novembroCoracao from "@/assets/theme/novembroazul-coracao.png";
import novembroBigode from "@/assets/theme/novembroazul-bigode.png";
// Ano Novo
import anoNovoFogos from "@/assets/theme/anonovo-fogos.png";
import anoNovoChampagne from "@/assets/theme/anonovo-champagne.png";
import anoNovoTacas from "@/assets/theme/anonovo-tacas.png";
import anoNovoBrilho from "@/assets/theme/anonovo-brilho.png";
// Dia dos Namorados
import namoradosCoracao from "@/assets/theme/namorados-coracao.png";
import namoradosRosa from "@/assets/theme/namorados-rosa.png";
import namoradosFlecha from "@/assets/theme/namorados-flecha.png";
import namoradosChocolate from "@/assets/theme/namorados-chocolate.png";
// Meio Ambiente
import ambienteFolha from "@/assets/theme/ambiente-folha.png";
import ambienteArvore from "@/assets/theme/ambiente-arvore.png";
import ambienteTerra from "@/assets/theme/ambiente-terra.png";
import ambienteReciclagem from "@/assets/theme/ambiente-reciclagem.png";
// Festa Literária
import literariaLivro from "@/assets/theme/literaria-livro.png";
import literariaPena from "@/assets/theme/literaria-pena.png";
import literariaMarcador from "@/assets/theme/literaria-marcador.png";
import literariaPilha from "@/assets/theme/literaria-pilha.png";

export type ThemeEffectId =
  | "none"
  | "festa-junina"
  | "natal"
  | "carnaval"
  | "halloween"
  | "pascoa"
  | "sao-joao"
  | "primavera"
  | "aniversario"
  | "dia-professor"
  | "sete-setembro"
  | "dia-criancas"
  | "dia-maes"
  | "dia-pais"
  | "volta-as-aulas"
  | "formatura"
  | "consciencia-negra"
  | "dia-estudante"
  | "outubro-rosa"
  | "novembro-azul"
  | "ano-novo"
  | "dia-dos-namorados"
  | "meio-ambiente"
  | "festa-literaria";

export type ThemePreset = {
  id: ThemeEffectId;
  label: string;
  description: string;
  emojis: string[];
  /** URLs de imagens realistas (PNG transparente). Quando presente, tem prioridade sobre emojis. */
  images?: string[];
  /** cor de brilho de fundo suave (rgba) */
  glow?: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "none",
    label: "Nenhum",
    description: "Sem animações sazonais.",
    emojis: [],
  },
  {
    id: "festa-junina",
    label: "Festa Junina",
    description: "Bandeirinhas, milho, fogueira, chapéu de palha e balão em 3D realista.",
    emojis: ["🎉", "🌽", "🔥", "🎪", "🪗", "⭐"],
    images: [juninaBandeirinha, juninaMilho, juninaFogueira, juninaChapeu, juninaBalao],
    glow: "rgba(255, 176, 46, 0.08)",
  },
  {
    id: "sao-joao",
    label: "São João",
    description: "Balões, sanfona, amendoim e pé-de-moleque em 3D.",
    emojis: ["🎈", "🔥", "🌽", "🥜", "🎶"],
    images: [saojoaoBalao, saojoaoSanfona, saojoaoAmendoim, saojoaoPedemoleque],
    glow: "rgba(255, 128, 40, 0.08)",
  },
  {
    id: "natal",
    label: "Natal",
    description: "Árvore, presentes, flocos e gorro do Papai Noel.",
    emojis: ["❄️", "🎄", "🎁", "⭐", "☃️"],
    images: [natalArvore, natalPresente, natalFloco, natalGorro],
    glow: "rgba(200, 230, 255, 0.1)",
  },
  {
    id: "carnaval",
    label: "Carnaval",
    description: "Máscaras, piñatas, confetes e chocalhos.",
    emojis: ["🎭", "🎊", "🎉", "🪅", "💃"],
    images: [carnavalMascara, carnavalPinata, carnavalConfete, carnavalChocalho],
    glow: "rgba(255, 60, 180, 0.08)",
  },
  {
    id: "halloween",
    label: "Halloween",
    description: "Abóboras, fantasmas, morcegos e doces.",
    emojis: ["🎃", "🦇", "👻", "🕷️", "🕸️"],
    images: [halloweenAbobora, halloweenFantasma, halloweenMorcego, halloweenDoce],
    glow: "rgba(255, 120, 0, 0.07)",
  },
  {
    id: "pascoa",
    label: "Páscoa",
    description: "Coelhos, ovos coloridos, chocolate e pintinhos.",
    emojis: ["🐰", "🥚", "🐣", "🌸", "🍫"],
    images: [pascoaCoelho, pascoaOvo, pascoaChocolate, pascoaPintinho],
    glow: "rgba(255, 200, 220, 0.1)",
  },
  {
    id: "primavera",
    label: "Primavera",
    description: "Flores, tulipas, borboletas e folhas.",
    emojis: ["🌸", "🌺", "🌷", "🦋", "🌼"],
    images: [primaveraFlor, primaveraBorboleta, primaveraTulipa, primaveraFolha],
    glow: "rgba(255, 200, 230, 0.08)",
  },
  {
    id: "aniversario",
    label: "Aniversário",
    description: "Bolo, balões, chapéus e presentes de festa.",
    emojis: ["🎂", "🎈", "🎁", "🎉", "✨"],
    images: [aniversarioBolo, aniversarioBalao, aniversarioChapeu, aniversarioPresente],
    glow: "rgba(255, 210, 90, 0.08)",
  },
  {
    id: "dia-professor",
    label: "Dia do Professor",
    description: "Maçãs, livros, lápis e capelo em 3D (15 de outubro).",
    emojis: ["🍎", "📚", "✏️", "🎓", "❤️", "🌟"],
    images: [professorMaca, professorLivros, professorLapis, professorFormatura],
    glow: "rgba(255, 90, 90, 0.08)",
  },
  {
    id: "sete-setembro",
    label: "7 de Setembro",
    description: "Bandeira do Brasil, estrelas, trompete e medalhas.",
    emojis: ["🇧🇷", "⭐", "🎺", "🎖️", "✨"],
    images: [seteBandeira, seteEstrela, seteTrompete, seteMedalha],
    glow: "rgba(0, 155, 60, 0.08)",
  },
  {
    id: "dia-criancas",
    label: "Dia das Crianças",
    description: "Urso de pelúcia, pipa, pirulito e carrinho (12 de outubro).",
    emojis: ["🧸", "🪁", "🎈", "🎠", "🍭", "🎨"],
    images: [criancasUrso, criancasPipa, criancasPirulito, criancasCarrinho],
    glow: "rgba(255, 180, 220, 0.09)",
  },
  {
    id: "dia-maes",
    label: "Dia das Mães",
    description: "Buquê, corações, rosas e presentes para as mamães.",
    emojis: ["💐", "🌹", "❤️", "🌷", "💖"],
    images: [maesBuque, maesCoracao, maesRosa, maesPresente],
    glow: "rgba(255, 130, 170, 0.09)",
  },
  {
    id: "dia-pais",
    label: "Dia dos Pais",
    description: "Gravata, relógio, bigode e caneca — homenagem aos papais.",
    emojis: ["👔", "🧔", "❤️", "🎁", "⭐"],
    images: [paisGravata, paisRelogio, paisBigode, paisCaneca],
    glow: "rgba(90, 140, 220, 0.08)",
  },
  {
    id: "volta-as-aulas",
    label: "Volta às Aulas",
    description: "Mochila, caderno, giz de cera e sino escolar.",
    emojis: ["🎒", "📚", "✏️", "📝", "🍎", "🖍️"],
    images: [aulasMochila, aulasCaderno, aulasGiz, aulasSino],
    glow: "rgba(120, 180, 255, 0.08)",
  },
  {
    id: "formatura",
    label: "Formatura",
    description: "Diploma, capelo, troféu e coroa de louros.",
    emojis: ["🎓", "📜", "🎊", "⭐", "🏆"],
    images: [formaturaDiploma, formaturaCapelo, formaturaTrofeu, formaturaLoureiro],
    glow: "rgba(180, 140, 255, 0.09)",
  },
  {
    id: "consciencia-negra",
    label: "Consciência Negra",
    description: "Punho, pomba, globo e livro (20 de novembro).",
    emojis: ["✊🏿", "🌍", "📖", "⭐", "🕊️"],
    images: [conscienciaPunho, conscienciaPomba, conscienciaGlobo, conscienciaLivro],
    glow: "rgba(180, 120, 60, 0.08)",
  },
  {
    id: "dia-estudante",
    label: "Dia do Estudante",
    description: "Lâmpada, livros, lápis e maçã (11 de agosto).",
    emojis: ["🎓", "📚", "✏️", "🎒", "💡"],
    images: [estudanteLampada, estudanteLivros, estudanteLapis, estudanteMaca],
    glow: "rgba(120, 200, 255, 0.08)",
  },
  {
    id: "outubro-rosa",
    label: "Outubro Rosa",
    description: "Laço rosa, flor, coração e tulipa — conscientização.",
    emojis: ["🎀", "🌸", "💗", "🌷", "💖"],
    images: [outubroLaco, outubroFlor, outubroCoracao, outubroTulipa],
    glow: "rgba(255, 130, 190, 0.1)",
  },
  {
    id: "novembro-azul",
    label: "Novembro Azul",
    description: "Laço azul, estetoscópio, coração e bigode — saúde do homem.",
    emojis: ["💙", "🎗️", "🩺", "⭐", "💠"],
    images: [novembroLaco, novembroEstetoscopio, novembroCoracao, novembroBigode],
    glow: "rgba(80, 150, 230, 0.09)",
  },
  {
    id: "ano-novo",
    label: "Ano Novo",
    description: "Fogos, champagne, taças e brilhos de celebração.",
    emojis: ["🎆", "🎇", "🥂", "✨", "🎉", "🍾"],
    images: [anoNovoFogos, anoNovoChampagne, anoNovoTacas, anoNovoBrilho],
    glow: "rgba(255, 220, 90, 0.1)",
  },
  {
    id: "dia-dos-namorados",
    label: "Dia dos Namorados",
    description: "Corações, rosa, flecha do cupido e chocolates (12 de junho).",
    emojis: ["❤️", "💕", "🌹", "💘", "💖"],
    images: [namoradosCoracao, namoradosRosa, namoradosFlecha, namoradosChocolate],
    glow: "rgba(255, 90, 130, 0.09)",
  },
  {
    id: "meio-ambiente",
    label: "Meio Ambiente",
    description: "Folha, árvore, planeta e reciclagem (5 de junho).",
    emojis: ["🌱", "🌳", "🌎", "🍃", "♻️", "🌿"],
    images: [ambienteFolha, ambienteArvore, ambienteTerra, ambienteReciclagem],
    glow: "rgba(80, 200, 120, 0.09)",
  },
  {
    id: "festa-literaria",
    label: "Festa Literária",
    description: "Livros, pena, marcador e pilha de clássicos.",
    emojis: ["📚", "📖", "✒️", "📝", "🔖", "✨"],
    images: [literariaLivro, literariaPena, literariaMarcador, literariaPilha],
    glow: "rgba(200, 160, 100, 0.08)",
  },
];

export function getPreset(id: string | null | undefined): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}

export type ThemeConfig = {
  tema: ThemeEffectId;
  ativo: boolean;
  intensidade: number; // 10..80 particles
};

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  tema: "none",
  ativo: false,
  intensidade: 30,
};

export async function fetchThemeConfig(): Promise<ThemeConfig> {
  const { data, error } = await supabase
    .from("configuracoes_tema" as never)
    .select("tema, ativo, intensidade")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return DEFAULT_THEME_CONFIG;
  const row = data as unknown as ThemeConfig;
  return {
    tema: (row.tema ?? "none") as ThemeEffectId,
    ativo: !!row.ativo,
    intensidade: Math.max(5, Math.min(80, row.intensidade ?? 30)),
  };
}

export async function saveThemeConfig(cfg: ThemeConfig) {
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from("configuracoes_tema" as never).upsert(
    {
      id: 1,
      tema: cfg.tema,
      ativo: cfg.ativo,
      intensidade: cfg.intensidade,
      updated_at: new Date().toISOString(),
      updated_by: user.user?.id ?? null,
    } as never,
    { onConflict: "id" },
  );
  if (error) throw error;
}
