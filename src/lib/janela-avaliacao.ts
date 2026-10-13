import { compartilhar } from "@/lib/placar/dados";
import { origemDoSite } from "@/lib/site";

/**
 * Quanto tempo depois de finalizada a pelada aceita avaliações. Quando fecha, sai o MVP.
 * O banco tem o mesmo número (função janela_de_avaliacao): mudou aqui, muda lá.
 */
export const JANELA_AVALIACAO_MS = 2 * 60 * 60 * 1000;
/** como a janela aparece nos textos */
export const JANELA_AVALIACAO_TEXTO = "2h";

/** "21:30" — a hora em que a janela de avaliação dessa pelada fecha. */
function horaDoFechamento(finalizadaEm: string) {
  return new Date(new Date(finalizadaEm).getTime() + JANELA_AVALIACAO_MS).toLocaleTimeString(
    "pt-BR",
    { hour: "2-digit", minute: "2-digit" },
  );
}

/**
 * Mensagem pro organizador mandar no grupo assim que finaliza: avisa que a janela abriu,
 * até que horas vai, e leva o link direto pra tela de avaliar.
 */
export function chamarPraAvaliar(pelada: {
  id: string;
  titulo: string;
  finalizada_em: string | null;
}) {
  const ate = pelada.finalizada_em ? ` Fecha às ${horaDoFechamento(pelada.finalizada_em)}.` : "";
  return compartilhar(
    [
      `⭐ *Avaliações abertas: ${pelada.titulo}*`,
      `A janela fica aberta por ${JANELA_AVALIACAO_TEXTO}.${ate} Dá a sua nota pra quem jogou e ajuda a escolher o MVP:`,
      `${origemDoSite()}/pelada/${pelada.id}/avaliar`,
    ].join("\n"),
  );
}
