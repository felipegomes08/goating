import type { Perfil } from "@/hooks/use-session";

/** Posições que dá pra escolher no perfil. */
export const POSICOES = ["GOL", "ZAG", "LAT", "VOL", "MEI", "ATA"];

/**
 * Cadastro completo: nome, cidade e posição. Sem cidade o feed e os rankings da cidade ficam
 * vazios, e sem posição a carta não tem as notas certas; por isso o app trava até preencher.
 */
export function cadastroCompleto(
  perfil: Pick<Perfil, "nome_exibicao" | "cidade" | "posicao_preferida">,
) {
  return !!(perfil.nome_exibicao.trim() && perfil.cidade?.trim() && perfil.posicao_preferida);
}
