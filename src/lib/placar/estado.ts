/** Estado do placar ao vivo e as contas do dia (tabela dos times, saldo de cada jogador). */

export type Lado = 0 | 1;

export type Gol = {
  id: string;
  lado: Lado;
  /** nulo = gol sem autor / contra */
  memberId: string | null;
  tempo: number;
  minuto: number;
};

/** Pênalti convertido na disputa que decide um jogo empatado. */
export type Penalti = { id: string; lado: Lado; memberId: string | null };

/** Disputa de pênaltis: só os convertidos, sem número fixo de cobranças. */
export type Disputa = {
  gols: Penalti[];
  /** tem turma que conta gol de pênalti na artilharia, tem turma que não */
  contaNaArtilharia: boolean;
};

/** O que dá pra marcar no ao vivo além do gol. */
export const TIPOS_DE_LANCE = ["assistencia", "defesa", "amarelo", "azul", "vermelho"] as const;
export type TipoDeLance = (typeof TIPOS_DE_LANCE)[number];

export const NOME_DO_LANCE: Record<TipoDeLance, string> = {
  assistencia: "Assistência",
  defesa: "Defesa épica",
  amarelo: "Cartão amarelo",
  azul: "Cartão azul",
  vermelho: "Cartão vermelho",
};

export type Lance = {
  id: string;
  tipo: TipoDeLance;
  lado: Lado;
  memberId: string;
  tempo: number;
  minuto: number;
  /** assistência: o gol que ela serviu (apagou o gol, some junto) */
  golId?: string;
};

export type Jogo = {
  id: string;
  /** índice do time de cada lado */
  times: [number, number];
  /** quem jogou de cada lado neste jogo */
  lados: [string[], string[]];
  gols: Gol[];
  tempo: number;
  /** cronômetro do tempo atual */
  acumuladoMs: number;
  iniciadoEm: number | null;
  alarmado: boolean;
  /** soma dos tempos já encerrados */
  duracaoMs: number;
  encerrado: boolean;
  /** lado vencedor; nulo = empate */
  vencedor: Lado | null;
  /** disputa de pênaltis; com o jogo ainda aberto, quer dizer que a disputa está rolando */
  penaltis?: Disputa | null;
  /** assistências, defesas épicas e cartões */
  lances?: Lance[];
};

export type EstadoPlacar = { v: 1; jogos: Jogo[] };

export type Contagem = "por_jogo" | "por_dia";

export const estadoVazio = (): EstadoPlacar => ({ v: 1, jogos: [] });

export function ehEstadoPlacar(valor: unknown): valor is EstadoPlacar {
  return (
    typeof valor === "object" &&
    valor !== null &&
    (valor as EstadoPlacar).v === 1 &&
    Array.isArray((valor as EstadoPlacar).jogos)
  );
}

export const decorridoMs = (jogo: Jogo, agora = Date.now()) =>
  jogo.acumuladoMs + (jogo.iniciadoEm ? agora - jogo.iniciadoEm : 0);

export const placarDoJogo = (jogo: Jogo): [number, number] => [
  jogo.gols.filter((g) => g.lado === 0).length,
  jogo.gols.filter((g) => g.lado === 1).length,
];

/** Placar da disputa de pênaltis, ou null quando o jogo não foi pros pênaltis. */
export const placarDosPenaltis = (jogo: Jogo): [number, number] | null =>
  jogo.penaltis
    ? [
        jogo.penaltis.gols.filter((g) => g.lado === 0).length,
        jogo.penaltis.gols.filter((g) => g.lado === 1).length,
      ]
    : null;

/** "2 × 2" ou "2 × 2 (4 × 3 nos pênaltis)". */
export function textoDoPlacar(
  placar: readonly [number, number],
  penaltis?: readonly [number | null, number | null] | null,
  curto = false,
) {
  const base = `${placar[0]} × ${placar[1]}`;
  if (!penaltis || penaltis[0] === null || penaltis[1] === null) return base;
  return `${base} (${penaltis[0]} × ${penaltis[1]} ${curto ? "pên." : "nos pênaltis"})`;
}

/**
 * Põe o jogador num lado do jogo (tirando do outro, se estava lá). Os gols dele não mudam:
 * cada gol guarda o lado em que saiu, então o placar continua o mesmo.
 */
export function colocarNoLado(jogo: Jogo, memberId: string, lado: Lado): Jogo {
  const lados: [string[], string[]] = [
    jogo.lados[0].filter((m) => m !== memberId),
    jogo.lados[1].filter((m) => m !== memberId),
  ];
  lados[lado] = [...lados[lado], memberId];
  return { ...jogo, lados };
}

/** Tira o jogador do jogo (marcou por engano). Gols e lances dele ficam. */
export const tirarDoJogo = (jogo: Jogo, memberId: string): Jogo => ({
  ...jogo,
  lados: [jogo.lados[0].filter((m) => m !== memberId), jogo.lados[1].filter((m) => m !== memberId)],
});

/**
 * Depois de mexer nos gols de um jogo encerrado: se o placar passou a ter um vencedor, ele
 * vale. Empate continua como estava (empate, ou o vencedor escolhido na mão / nos pênaltis).
 */
export function ajustarVencedor(jogo: Jogo): Jogo {
  if (!jogo.encerrado) return jogo;
  const [a, b] = placarDoJogo(jogo);
  if (a === b) return jogo;
  return { ...jogo, vencedor: a > b ? 0 : 1 };
}

export const jogoAtual = (estado: EstadoPlacar) => {
  const ultimo = estado.jogos.at(-1);
  return ultimo && !ultimo.encerrado ? ultimo : null;
};

/**
 * Quem espera, em ordem de entrada: primeiro quem está há mais tempo de fora.
 * O time que acabou de sair vai pro fim da fila.
 */
export function filaDeEspera(estado: EstadoPlacar, numTimes: number, emCampo: number[]) {
  const ultimaVez = (time: number) =>
    estado.jogos.map((j) => j.times.includes(time)).lastIndexOf(true);
  return Array.from({ length: numTimes }, (_, i) => i)
    .filter((t) => !emCampo.includes(t))
    .sort((a, b) => ultimaVez(a) - ultimaVez(b) || a - b);
}

/** Sugestão do próximo confronto: quem ganhou fica; no empate fica o desafiante. */
export function sugerirProximo(estado: EstadoPlacar, numTimes: number): [number, number] {
  const ultimo = estado.jogos.filter((j) => j.encerrado).at(-1);
  if (!ultimo) return [0, 1];
  if (numTimes <= 2) return ultimo.times;
  const fica = ultimo.times[ultimo.vencedor === 0 ? 0 : 1];
  const desafiante = filaDeEspera(estado, numTimes, [fica])[0] ?? ultimo.times[0];
  return [fica, desafiante];
}

export type LinhaTime = {
  time: number;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
};

export type JogoFinal = {
  times: [number, number];
  placar: [number, number];
  vencedor: number | null;
  penaltis?: [number, number] | null;
};

export const jogoFinal = (jogo: Jogo): JogoFinal => ({
  times: jogo.times,
  placar: placarDoJogo(jogo),
  vencedor: jogo.vencedor === null ? null : jogo.times[jogo.vencedor],
  penaltis: placarDosPenaltis(jogo),
});

/** Classificação do dia: vitórias, depois saldo, depois gols feitos. */
export function tabelaDosTimes(jogos: JogoFinal[]): LinhaTime[] {
  const linhas = new Map<number, LinhaTime>();
  const linha = (time: number) => {
    let l = linhas.get(time);
    if (!l) {
      l = { time, jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0 };
      linhas.set(time, l);
    }
    return l;
  };
  for (const jogo of jogos) {
    for (const lado of [0, 1] as const) {
      const l = linha(jogo.times[lado]);
      l.jogos++;
      l.golsPro += jogo.placar[lado];
      l.golsContra += jogo.placar[lado === 0 ? 1 : 0];
      if (jogo.vencedor === null) l.empates++;
      else if (jogo.vencedor === jogo.times[lado]) l.vitorias++;
      else l.derrotas++;
    }
  }
  return [...linhas.values()].sort(compararTimes);
}

const compararTimes = (a: LinhaTime, b: LinhaTime) =>
  b.vitorias - a.vitorias ||
  b.golsPro - b.golsContra - (a.golsPro - a.golsContra) ||
  b.golsPro - a.golsPro;

/** Campeões do dia. Mais de um = terminou empatado em tudo. */
export function campeoesDoDia(tabela: LinhaTime[]) {
  const primeiro = tabela[0];
  if (!primeiro) return [];
  return tabela.filter((l) => compararTimes(primeiro, l) === 0).map((l) => l.time);
}

export type LinhaJogador = {
  memberId: string;
  /** time em que mais jogou no dia */
  time: number;
  gols: number;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  assistencias: number;
  defesas: number;
  amarelos: number;
  azuis: number;
  vermelhos: number;
};

const TOTAL_DO_LANCE = {
  assistencia: "assistencias",
  defesa: "defesas",
  amarelo: "amarelos",
  azul: "azuis",
  vermelho: "vermelhos",
} as const satisfies Record<TipoDeLance, keyof LinhaJogador>;

/**
 * Saldo de cada jogador no dia.
 * por_jogo: cada jogo conta (vitória só pra quem estava em campo naquele jogo).
 * por_dia: o dia inteiro vale um resultado — vitória pro time campeão, derrota pros outros.
 */
export function saldoDosJogadores(estado: EstadoPlacar, contagem: Contagem): LinhaJogador[] {
  const encerrados = estado.jogos.filter((j) => j.encerrado);
  const linhas = new Map<string, LinhaJogador & { porTime: Map<number, number> }>();
  const linha = (memberId: string) => {
    let l = linhas.get(memberId);
    if (!l) {
      l = {
        memberId,
        time: 0,
        gols: 0,
        jogos: 0,
        vitorias: 0,
        empates: 0,
        derrotas: 0,
        assistencias: 0,
        defesas: 0,
        amarelos: 0,
        azuis: 0,
        vermelhos: 0,
        porTime: new Map(),
      };
      linhas.set(memberId, l);
    }
    return l;
  };

  for (const jogo of encerrados) {
    for (const lado of [0, 1] as const) {
      for (const memberId of jogo.lados[lado]) {
        const l = linha(memberId);
        l.jogos++;
        l.porTime.set(jogo.times[lado], (l.porTime.get(jogo.times[lado]) ?? 0) + 1);
        if (jogo.vencedor === null) l.empates++;
        else if (jogo.vencedor === lado) l.vitorias++;
        else l.derrotas++;
      }
    }
    for (const gol of jogo.gols) {
      if (gol.memberId && linhas.has(gol.memberId)) linha(gol.memberId).gols++;
    }
    if (jogo.penaltis?.contaNaArtilharia) {
      for (const gol of jogo.penaltis.gols) {
        if (gol.memberId && linhas.has(gol.memberId)) linha(gol.memberId).gols++;
      }
    }
    for (const lance of jogo.lances ?? []) {
      if (linhas.has(lance.memberId)) linha(lance.memberId)[TOTAL_DO_LANCE[lance.tipo]]++;
    }
  }

  const campeoes = campeoesDoDia(tabelaDosTimes(encerrados.map(jogoFinal)));
  return [...linhas.values()].map(({ porTime, ...l }) => {
    const time = [...porTime.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    if (contagem === "por_jogo") return { ...l, time };
    const campeao = campeoes.includes(time);
    return {
      ...l,
      time,
      vitorias: campeao && campeoes.length === 1 ? 1 : 0,
      empates: campeao && campeoes.length > 1 ? 1 : 0,
      derrotas: campeao ? 0 : 1,
    };
  });
}

/** Formato que a função salvar_placar do banco espera. */
export function montarPayload(estado: EstadoPlacar, contagem: Contagem) {
  const encerrados = estado.jogos.filter((j) => j.encerrado);
  return {
    jogadores: saldoDosJogadores(estado, contagem).map((l) => ({
      member_id: l.memberId,
      gols: l.gols,
      jogos: l.jogos,
      vitorias: l.vitorias,
      empates: l.empates,
      derrotas: l.derrotas,
      assistencias: l.assistencias,
      defesas: l.defesas,
      amarelos: l.amarelos,
      azuis: l.azuis,
      vermelhos: l.vermelhos,
    })),
    jogos: encerrados.map((jogo, i) => {
      const [golsA, golsB] = placarDoJogo(jogo);
      const penaltis = placarDosPenaltis(jogo);
      return {
        ordem: i + 1,
        time_a: jogo.times[0],
        time_b: jogo.times[1],
        gols_a: golsA,
        gols_b: golsB,
        vencedor: jogo.vencedor === null ? null : jogo.times[jogo.vencedor],
        duracao_seg: Math.round(jogo.duracaoMs / 1000),
        penaltis_a: penaltis?.[0] ?? null,
        penaltis_b: penaltis?.[1] ?? null,
        penaltis_na_artilharia: jogo.penaltis?.contaNaArtilharia ?? true,
        escalacao: ([0, 1] as const).flatMap((lado) =>
          jogo.lados[lado].map((memberId) => ({ member_id: memberId, time: jogo.times[lado] })),
        ),
        gols: [
          ...jogo.gols.map((g) => ({
            member_id: g.memberId,
            time: jogo.times[g.lado],
            tempo: g.tempo,
            minuto: g.minuto,
            penalti: false,
          })),
          // os da disputa ficam marcados: não entram no placar do jogo
          ...(jogo.penaltis?.gols ?? []).map((g) => ({
            member_id: g.memberId,
            time: jogo.times[g.lado],
            tempo: jogo.tempo,
            minuto: 0,
            penalti: true,
          })),
        ],
        lances: (jogo.lances ?? []).map((l) => ({
          member_id: l.memberId,
          time: jogo.times[l.lado],
          tipo: l.tipo,
          tempo: l.tempo,
          minuto: l.minuto,
        })),
      };
    }),
  };
}

export const NOMES_PADRAO = (n: number) => Array.from({ length: n }, (_, i) => `Time ${i + 1}`);

export function nomeDoTime(nomes: string[] | null | undefined, time: number) {
  return nomes?.[time]?.trim() || `Time ${time + 1}`;
}

/** Cores fixas por time (classes completas pro Tailwind enxergar). */
export const CORES_TIME = [
  {
    texto: "text-orange-600",
    fundo: "bg-orange-50",
    borda: "border-orange-500",
    solido: "bg-orange-500",
    ring: "ring-orange-400",
  },
  {
    texto: "text-blue-600",
    fundo: "bg-blue-50",
    borda: "border-blue-500",
    solido: "bg-blue-500",
    ring: "ring-blue-400",
  },
  {
    texto: "text-rose-600",
    fundo: "bg-rose-50",
    borda: "border-rose-500",
    solido: "bg-rose-500",
    ring: "ring-rose-400",
  },
  {
    texto: "text-violet-600",
    fundo: "bg-violet-50",
    borda: "border-violet-500",
    solido: "bg-violet-500",
    ring: "ring-violet-400",
  },
  {
    texto: "text-amber-600",
    fundo: "bg-amber-50",
    borda: "border-amber-500",
    solido: "bg-amber-500",
    ring: "ring-amber-400",
  },
  {
    texto: "text-teal-600",
    fundo: "bg-teal-50",
    borda: "border-teal-500",
    solido: "bg-teal-500",
    ring: "ring-teal-400",
  },
] as const;

export const corDoTime = (time: number) => CORES_TIME[time % CORES_TIME.length]!;

export function formatarRelogio(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
