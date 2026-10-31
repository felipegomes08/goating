import {
  Crown,
  Footprints,
  Goal,
  Handshake,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";

/** Liga da turma: um período com pontos próprios. As datas vêm como "aaaa-mm-dd". */
export type LigaBase = {
  inicio: string;
  fim: string;
  encerrada_em: string | null;
};

export type Situacao = "futura" | "rolando" | "encerrada";

const hoje = () => new Date().toLocaleDateString("sv-SE");

export function situacaoDaLiga(liga: LigaBase): Situacao {
  if (liga.encerrada_em) return "encerrada";
  if (liga.inicio > hoje()) return "futura";
  return "rolando";
}

const dataCurta = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

/** "1 de nov. a 31 de dez." */
export const periodoDaLiga = (liga: LigaBase) =>
  `${dataCurta(liga.inicio)} a ${dataCurta(liga.fim)}`;

/** Quanto do período já passou (0 a 1). */
export function progressoDaLiga(liga: LigaBase) {
  const ini = new Date(`${liga.inicio}T00:00:00`).getTime();
  const fim = new Date(`${liga.fim}T23:59:59`).getTime();
  return Math.min(1, Math.max(0, (Date.now() - ini) / Math.max(1, fim - ini)));
}

/** Dias que faltam (0 no último dia). */
export function diasQueFaltam(liga: LigaBase) {
  const fim = new Date(`${liga.fim}T12:00:00`).getTime();
  const agora = new Date(`${hoje()}T12:00:00`).getTime();
  return Math.max(0, Math.round((fim - agora) / 86_400_000));
}

/** Data daqui a N meses, em "aaaa-mm-dd" (atalhos da folha de criar). */
export function daquiMeses(meses: number, de = hoje()) {
  const d = new Date(`${de}T12:00:00`);
  d.setMonth(d.getMonth() + meses);
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("sv-SE");
}

export type Pontos = {
  pts_vitoria: number;
  pts_empate: number;
  pts_presenca: number;
  pts_gol: number;
  pts_mvp: number;
};

export const PONTOS_PADRAO: Pontos = {
  pts_vitoria: 3,
  pts_empate: 1,
  pts_presenca: 1,
  pts_gol: 0,
  pts_mvp: 0,
};

export const ITENS_DE_PONTOS: { chave: keyof Pontos; rotulo: string }[] = [
  { chave: "pts_vitoria", rotulo: "Vitória" },
  { chave: "pts_empate", rotulo: "Empate" },
  { chave: "pts_presenca", rotulo: "Presença (por pelada jogada)" },
  { chave: "pts_gol", rotulo: "Gol" },
  { chave: "pts_mvp", rotulo: "MVP da pelada" },
];

/** Os prêmios do fim da liga (e os líderes de cada um durante ela). */
export type Categoria =
  "campeao" | "artilheiro" | "garcom" | "paredao" | "rei_mvp" | "mais_presente";

export const CATEGORIAS: Record<
  Categoria,
  { rotulo: string; icone: LucideIcon; unidade: (n: number) => string; campo?: string }
> = {
  campeao: { rotulo: "Campeão", icone: Crown, unidade: (n) => `${n} pts` },
  artilheiro: {
    rotulo: "Artilheiro",
    icone: Goal,
    unidade: (n) => `${n} ${n === 1 ? "gol" : "gols"}`,
    campo: "gols",
  },
  garcom: {
    rotulo: "Garçom",
    icone: Handshake,
    unidade: (n) => `${n} ${n === 1 ? "assistência" : "assistências"}`,
    campo: "assistencias",
  },
  paredao: {
    rotulo: "Paredão",
    icone: ShieldCheck,
    unidade: (n) => `${n} ${n === 1 ? "defesa" : "defesas"}`,
    campo: "defesas",
  },
  rei_mvp: {
    rotulo: "Rei do MVP",
    icone: Star,
    unidade: (n) => `${n} ${n === 1 ? "MVP" : "MVPs"}`,
    campo: "mvps",
  },
  mais_presente: {
    rotulo: "Mais presente",
    icone: Footprints,
    unidade: (n) => `${n} ${n === 1 ? "pelada" : "peladas"}`,
    campo: "peladas",
  },
};

export const ORDEM_DAS_CATEGORIAS: Categoria[] = [
  "campeao",
  "artilheiro",
  "garcom",
  "paredao",
  "rei_mvp",
  "mais_presente",
];
