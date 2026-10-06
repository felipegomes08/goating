/** Nick do jogador: o @ único que identifica a pessoa na busca. */

export const NICK_MIN = 3;
export const NICK_MAX = 20;

/** Limpa o que o usuário digita: sem @, sem acento, minúsculo, só letra, número, "_" e ".". */
export function normalizarNick(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, NICK_MAX);
}

/** Devolve o motivo de não servir, ou null quando o nick é válido. */
export function problemaDoNick(nick: string) {
  if (nick.length < NICK_MIN) return `Pelo menos ${NICK_MIN} caracteres.`;
  if (!/[a-z]/.test(nick)) return "Precisa ter pelo menos uma letra.";
  if (/^[._]|[._]$/.test(nick)) return "Não pode começar nem terminar com ponto ou _.";
  return null;
}
