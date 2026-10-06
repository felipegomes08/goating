/** Sorteio equilibrado dos times por estrelas e posição. */

export const POSICOES = ["GOL", "ZAG", "LAT", "VOL", "MEI", "ATA"] as const;
export const ESTRELAS_PADRAO = 3;

export type Sorteavel = { id: string; estrelas: number; posicao: string | null };

/** Overall do Goating (0–100) vira estrelas (1–5). Sem avaliação = padrão. */
export function estrelasDoOverall(overall: number | string | null | undefined, avaliacoes = 1) {
  const n = Number(overall);
  if (!avaliacoes || !Number.isFinite(n) || n <= 0) return null;
  return Math.min(5, Math.max(1, Math.round(n / 20)));
}

function embaralhar<T>(lista: T[]) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

function distribuir(jogadores: Sorteavel[], numTimes: number, ruido: number) {
  const times = Array.from({ length: numTimes }, () => ({
    ids: [] as string[],
    forca: 0,
    porPosicao: new Map<string, number>(),
  }));
  const maximo = Math.ceil(jogadores.length / numTimes);

  // Goleiros primeiro (um por time), depois do mais forte pro mais fraco.
  // O ruído mexe na ordem a cada sorteio sem estragar o equilíbrio.
  const ordem = embaralhar(jogadores)
    .map((j) => ({ j, peso: j.estrelas + (Math.random() - 0.5) * ruido }))
    .sort(
      (a, b) => Number(b.j.posicao === "GOL") - Number(a.j.posicao === "GOL") || b.peso - a.peso,
    )
    .map((x) => x.j);

  for (const jogador of ordem) {
    const pos = jogador.posicao ?? "";
    const candidatos = times.filter((t) => t.ids.length < maximo);
    const menorElenco = Math.min(...candidatos.map((t) => t.ids.length));
    const escolhido = embaralhar(candidatos.filter((t) => t.ids.length === menorElenco)).sort(
      (a, b) =>
        (pos ? (a.porPosicao.get(pos) ?? 0) - (b.porPosicao.get(pos) ?? 0) : 0) ||
        a.forca - b.forca,
    )[0]!;
    escolhido.ids.push(jogador.id);
    escolhido.forca += jogador.estrelas;
    if (pos) escolhido.porPosicao.set(pos, (escolhido.porPosicao.get(pos) ?? 0) + 1);
  }
  return times;
}

/** Mesma divisão de antes, não importa a ordem dos times nem dos jogadores. */
function assinatura(times: string[][]) {
  return times
    .map((t) => [...t].sort().join(","))
    .sort()
    .join("|");
}

/**
 * Devolve os ids de cada time. Tenta várias divisões e fica com a de menor
 * diferença de força. Passando `anterior`, garante uma divisão diferente
 * (é o "sortear de novo").
 */
export function sortearTimes(
  jogadores: Sorteavel[],
  numTimes: number,
  anterior?: string[][],
): string[][] {
  const evitar = anterior ? assinatura(anterior) : null;
  let melhor: { times: string[][]; diferenca: number } | null = null;

  for (let tentativa = 0; tentativa < 30; tentativa++) {
    const times = distribuir(jogadores, numTimes, anterior ? 1.5 : 0.8);
    const ids = times.map((t) => t.ids);
    if (evitar && assinatura(ids) === evitar) continue;
    const forcas = times.map((t) => t.forca);
    const diferenca = Math.max(...forcas) - Math.min(...forcas);
    if (!melhor || diferenca < melhor.diferenca) melhor = { times: ids, diferenca };
    // No "sortear de novo" a primeira divisão boa já serve — senão cai sempre na mesma.
    if (anterior && diferenca <= 1) break;
  }
  return melhor?.times ?? distribuir(jogadores, numTimes, 0).map((t) => t.ids);
}
