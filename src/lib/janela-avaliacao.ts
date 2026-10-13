import { compartilhar } from "@/lib/placar/dados";
import { origemDoSite } from "@/lib/site";

/**
 * Quanto tempo depois de finalizada a pelada aceita avaliações. Quando fecha, sai o MVP.
 * O banco tem o mesmo número (função janela_de_avaliacao): mudou aqui, muda lá.
 */
export const JANELA_AVALIACAO_MS = 2 * 60 * 60 * 1000;
/** como a janela aparece nos textos */
export const JANELA_AVALIACAO_TEXTO = "2h";

type ComJanela = {
  status?: string | undefined;
  finalizada_em?: string | null | undefined;
  /** fim combinado da janela dessa pelada; vazio = o prazo normal depois de finalizada */
  avaliacao_ate?: string | null | undefined;
};

/** Quando a janela de avaliação dessa pelada fecha (null = ainda nem foi finalizada). */
export function fimDaJanela(pelada: ComJanela) {
  if (pelada.avaliacao_ate) return new Date(pelada.avaliacao_ate);
  if (!pelada.finalizada_em) return null;
  return new Date(new Date(pelada.finalizada_em).getTime() + JANELA_AVALIACAO_MS);
}

/** true enquanto a pelada finalizada ainda aceita avaliações. */
export function janelaAberta(pelada: ComJanela) {
  const fim = fimDaJanela(pelada);
  return pelada.status === "finalizada" && !!fim && Date.now() < fim.getTime();
}

/**
 * Mensagem pro organizador mandar no grupo assim que finaliza: avisa que a janela abriu,
 * até que horas vai, e leva o link direto pra tela de avaliar.
 */
export function chamarPraAvaliar(pelada: ComJanela & { id: string; titulo: string }) {
  const fim = fimDaJanela(pelada);
  const ate = fim
    ? ` A janela fecha às ${fim.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`
    : "";
  return compartilhar(
    [
      `⭐ *Avaliações abertas: ${pelada.titulo}*`,
      `Dá a sua nota pra quem jogou e ajuda a escolher o MVP.${ate}`,
      `${origemDoSite()}/pelada/${pelada.id}/avaliar`,
    ].join("\n"),
  );
}
