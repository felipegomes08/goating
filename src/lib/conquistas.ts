import {
  Award,
  CalendarCheck,
  Crown,
  Eye,
  Flag,
  Flame,
  Gem,
  Goal,
  Hand,
  HandHeart,
  Heart,
  Map as Mapa,
  Medal,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Catálogo das conquistas (medalhas do perfil). O mesmo catálogo está no banco
 * (`catalogo_de_conquistas`): código, nome e meta mudam juntos aqui e lá.
 */
export type Conquista = {
  codigo: string;
  nome: string;
  /** como ganhar, em poucas palavras */
  descricao: string;
  /** o que conta pro progresso ("gols", "peladas"...) */
  unidade: string;
  icone: LucideIcon;
  /** cor da medalha ganha */
  cor: string;
  /** só existe pra quem é Premium */
  premium?: boolean;
};

const OURO = "#E9B93A";
const VERDE = "#22C55E";
const AZUL = "#3B82F6";
const ROXO = "#8B5CF6";
const LARANJA = "#F97316";
const ROSA = "#EC4899";

export const CONQUISTAS: Conquista[] = [
  {
    codigo: "mvp_1",
    nome: "Primeiro MVP",
    descricao: "Seja MVP de uma pelada",
    unidade: "MVPs",
    icone: Crown,
    cor: OURO,
  },
  {
    codigo: "mvp_5",
    nome: "5 MVPs",
    descricao: "Seja MVP 5 vezes",
    unidade: "MVPs",
    icone: Crown,
    cor: OURO,
  },
  {
    codigo: "mvp_10",
    nome: "10 MVPs",
    descricao: "Seja MVP 10 vezes",
    unidade: "MVPs",
    icone: Crown,
    cor: OURO,
  },
  {
    codigo: "mvp_25",
    nome: "25 MVPs",
    descricao: "Seja MVP 25 vezes",
    unidade: "MVPs",
    icone: Crown,
    cor: OURO,
  },
  {
    codigo: "gol_1",
    nome: "Primeiro gol",
    descricao: "Marque seu primeiro gol",
    unidade: "gols",
    icone: Goal,
    cor: VERDE,
  },
  {
    codigo: "gols_10",
    nome: "10 gols",
    descricao: "Marque 10 gols",
    unidade: "gols",
    icone: Goal,
    cor: VERDE,
  },
  {
    codigo: "gols_50",
    nome: "50 gols",
    descricao: "Marque 50 gols",
    unidade: "gols",
    icone: Goal,
    cor: VERDE,
  },
  {
    codigo: "gols_100",
    nome: "100 gols",
    descricao: "Marque 100 gols",
    unidade: "gols",
    icone: Goal,
    cor: VERDE,
  },
  {
    codigo: "hat_trick",
    nome: "Hat-trick",
    descricao: "Faça 3 gols numa pelada",
    unidade: "gols numa pelada",
    icone: Flame,
    cor: LARANJA,
  },
  {
    codigo: "mes_artilheiro",
    nome: "Mês artilheiro",
    descricao: "Faça 10 gols no mesmo mês",
    unidade: "gols num mês",
    icone: Flame,
    cor: LARANJA,
  },
  {
    codigo: "garcom_10",
    nome: "Garçom",
    descricao: "Dê 10 assistências",
    unidade: "assistências",
    icone: HandHeart,
    cor: AZUL,
  },
  {
    codigo: "garcom_50",
    nome: "Garçom de ouro",
    descricao: "Dê 50 assistências",
    unidade: "assistências",
    icone: HandHeart,
    cor: AZUL,
  },
  {
    codigo: "paredao_10",
    nome: "Paredão",
    descricao: "Faça 10 defesas épicas",
    unidade: "defesas",
    icone: Hand,
    cor: AZUL,
  },
  {
    codigo: "paredao_50",
    nome: "Muralha",
    descricao: "Faça 50 defesas épicas",
    unidade: "defesas",
    icone: Shield,
    cor: AZUL,
  },
  {
    codigo: "peladas_10",
    nome: "10 peladas",
    descricao: "Jogue 10 peladas",
    unidade: "peladas",
    icone: CalendarCheck,
    cor: VERDE,
  },
  {
    codigo: "peladas_50",
    nome: "50 peladas",
    descricao: "Jogue 50 peladas",
    unidade: "peladas",
    icone: CalendarCheck,
    cor: VERDE,
  },
  {
    codigo: "peladas_100",
    nome: "100 peladas",
    descricao: "Jogue 100 peladas",
    unidade: "peladas",
    icone: CalendarCheck,
    cor: VERDE,
  },
  {
    codigo: "fiel",
    nome: "Fiel",
    descricao: "Jogue 4 semanas seguidas",
    unidade: "semanas seguidas",
    icone: Heart,
    cor: ROSA,
  },
  {
    codigo: "rodado",
    nome: "Rodado",
    descricao: "Jogue em 3 turmas diferentes",
    unidade: "turmas",
    icone: Mapa,
    cor: ROSA,
  },
  {
    codigo: "vitorias_10",
    nome: "10 vitórias",
    descricao: "Vença 10 jogos",
    unidade: "vitórias",
    icone: Trophy,
    cor: OURO,
  },
  {
    codigo: "vitorias_50",
    nome: "50 vitórias",
    descricao: "Vença 50 jogos",
    unidade: "vitórias",
    icone: Trophy,
    cor: OURO,
  },
  {
    codigo: "tier_prata",
    nome: "Chegou no Prata",
    descricao: "Alcance o nível Prata",
    unidade: "nível",
    icone: Medal,
    cor: "#9CA3AF",
  },
  {
    codigo: "tier_ouro",
    nome: "Chegou no Ouro",
    descricao: "Alcance o nível Ouro",
    unidade: "nível",
    icone: Medal,
    cor: OURO,
  },
  {
    codigo: "tier_platina",
    nome: "Chegou no Platina",
    descricao: "Alcance o nível Platina",
    unidade: "nível",
    icone: Medal,
    cor: "#22D3EE",
  },
  {
    codigo: "tier_lendario",
    nome: "Chegou no Lendário",
    descricao: "Alcance o nível Lendário",
    unidade: "nível",
    icone: Medal,
    cor: ROXO,
  },
  {
    codigo: "tier_goat",
    nome: "Virou GOAT",
    descricao: "Alcance o nível GOAT",
    unidade: "nível",
    icone: Award,
    cor: ROXO,
  },
  {
    codigo: "avaliador",
    nome: "Olheiro",
    descricao: "Avalie 50 vezes",
    unidade: "avaliações",
    icone: Eye,
    cor: AZUL,
  },
  {
    codigo: "seguidores_10",
    nome: "Tem torcida",
    descricao: "Tenha 10 seguidores",
    unidade: "seguidores",
    icone: Users,
    cor: ROSA,
  },
  {
    codigo: "criou_turma",
    nome: "Fundou uma turma",
    descricao: "Crie uma turma",
    unidade: "turmas",
    icone: Flag,
    cor: VERDE,
  },
  {
    codigo: "organizou_10",
    nome: "Organizador",
    descricao: "Organize 10 peladas",
    unidade: "peladas",
    icone: Star,
    cor: VERDE,
  },
  {
    codigo: "apoiador",
    nome: "Apoiador",
    descricao: "Seja Premium",
    unidade: "",
    icone: Gem,
    cor: OURO,
    premium: true,
  },
  {
    codigo: "estiloso",
    nome: "Estiloso",
    descricao: "Use moldura e capa do Premium",
    unidade: "",
    icone: Sparkles,
    cor: OURO,
    premium: true,
  },
];

export const conquistaPorCodigo = (codigo: string) =>
  CONQUISTAS.find((c) => c.codigo === codigo) ?? null;
