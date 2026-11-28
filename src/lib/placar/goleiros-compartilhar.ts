import { compartilhar } from "@/lib/placar/dados";
import { compartilharTabela } from "@/lib/placar/poster";
import {
  COLUNAS_GOLEIRO,
  formatarMedia,
  type ColunaGoleiro,
  type LinhaTabelaGoleiro,
} from "@/components/goating/tabela-ranking";

/**
 * Goleiros pro WhatsApp, na ordem da tabela: quem está na disputa com medalha, quem jogou pouco
 * no fim. `titulo` é a turma ou a liga; `subtitulo` diz o período e por qual coluna está.
 */
export async function compartilharTextoDosGoleiros(
  titulo: string,
  subtitulo: string,
  linhas: LinhaTabelaGoleiro[],
) {
  const medalhas = ["🥇", "🥈", "🥉"];
  const naDisputa = linhas.filter((l) => !l.poucosJogos);
  const fora = linhas.filter((l) => l.poucosJogos);
  const linhaDe = (l: LinhaTabelaGoleiro) =>
    `   ${l.jogos} ${l.jogos === 1 ? "jogo" : "jogos"} · ${l.vitorias} V · ${l.sofridos} ${l.sofridos === 1 ? "gol sofrido" : "gols sofridos"} · média ${formatarMedia(l.media)}${l.defesas ? ` · ${l.defesas} ${l.defesas === 1 ? "defesa épica" : "defesas épicas"}` : ""}${l.sem_sofrer ? ` · ${l.sem_sofrer} sem sofrer gol` : ""}`;
  const texto = [
    `🧤 *${titulo}*`,
    subtitulo,
    "",
    ...naDisputa.flatMap((l, i) => [`${medalhas[i] ?? `${i + 1}.`} *${l.nome}*`, linhaDe(l)]),
    ...(fora.length
      ? ["", "_Poucos jogos no período:_", ...fora.flatMap((l) => [`• ${l.nome}`, linhaDe(l)])]
      : []),
  ].join("\n");
  return compartilhar(texto);
}

/** Tabela dos goleiros como imagem, com a coluna da ordem em destaque. */
export function compartilharImagemDosGoleiros(dados: {
  etiqueta: string;
  titulo: string;
  periodo: string;
  ordem: ColunaGoleiro;
  linhas: LinhaTabelaGoleiro[];
}) {
  return compartilharTabela(
    {
      etiqueta: dados.etiqueta,
      titulo: dados.titulo,
      periodo: dados.periodo,
      colunas: COLUNAS_GOLEIRO.map((c) => c.sigla),
      colunaOrdenada: COLUNAS_GOLEIRO.findIndex((c) => c.id === dados.ordem),
      linhas: dados.linhas.map((l) => ({
        nome: l.poucosJogos ? `${l.nome} (poucos jogos)` : l.nome,
        valores: COLUNAS_GOLEIRO.map((c) =>
          c.id === "media" ? formatarMedia(l.media) : String(l[c.id]),
        ),
      })),
      legenda:
        "J jogos  ·  V vitórias  ·  GS gols sofridos  ·  Média por jogo  ·  D defesas  ·  SG sem sofrer gol",
    },
    "goating-goleiros.png",
  );
}
