/** Leitura da lista colada do WhatsApp: nomes soltos ou já separados por time. */

export type TimeDaLista = { nome: string; jogadores: string[] };
export type ListaLida = {
  /** Todos os nomes, na ordem em que aparecem, sem repetição. */
  nomes: string[];
  /** Preenchido só quando a lista já veio dividida ("Time 1:", "Colete:"...). */
  times: TimeDaLista[] | null;
};

const EMOJI =
  /\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Variation_Selector}|\p{Join_Control}/gu;

function limparNome(bruto: string) {
  return bruto
    .replace(EMOJI, "")
    .replace(/^[\s\-–—•*·>_]+/, "")
    .replace(/^\d+\s*[-.)º°:]?\s*/, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ehCabecalhoDeTime(linha: string) {
  const semMarcador = linha.replace(EMOJI, "").replace(/^[^\p{L}\p{N}]+/u, "");
  return /^(time|equipe|colete|sem colete|team|lado)\b/i.test(semMarcador);
}

/** Linhas que claramente não são jogador: data, horário, valor, local, títulos. */
function ehRuido(linha: string, nome: string) {
  if (!nome || nome.length > 40) return true;
  if (!/\p{L}/u.test(nome)) return true;
  if (/\d{1,2}[:h]\d{2}|\d{1,2}\/\d{1,2}|r\$|pix\b|https?:/i.test(linha)) return true;
  if (
    /^(lista|confirmados?|presen[cç]a|reservas?|espera|goleiros?|local|data|hor[aá]rio|valor|pelada|fut|futebol|racha|rach[aã]o)\b/i.test(
      nome,
    )
  ) {
    return true;
  }
  return /:\s*$/.test(linha);
}

const NUMERADA = /^\s*\d+\s*[-.)º°:]?\s*\S/;
const COM_MARCADOR = /^\s*[-–—•·>]\s*\S|^\s*\*\s+\S/;

export function chaveNome(nome: string) {
  return nome.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function lerLista(texto: string): ListaLida {
  const nomes: string[] = [];
  const vistos = new Set<string>();
  const times: TimeDaLista[] = [];
  let atual: TimeDaLista | null = null;

  const adicionar = (bruto: string, linha: string) => {
    const nome = limparNome(bruto);
    if (ehRuido(linha, nome)) return;
    const chave = chaveNome(nome);
    if (vistos.has(chave)) return;
    vistos.add(chave);
    nomes.push(nome);
    atual?.jogadores.push(nome);
  };

  const linhas = texto.split(/\r?\n/);
  // Lista numerada ("1- João"): o que não tem número nem marcador é título, aviso, regra.
  const soMarcadas = linhas.filter((l) => NUMERADA.test(l)).length >= 3;

  for (const crua of linhas) {
    const linha = crua.trim();
    if (!linha) continue;
    if (ehCabecalhoDeTime(linha)) {
      const [cabeca = "", ...resto] = linha.split(":");
      atual = { nome: limparNome(cabeca) || `Time ${times.length + 1}`, jogadores: [] };
      times.push(atual);
      // "Time 1: João, Pedro" — jogadores na mesma linha do cabeçalho
      for (const parte of resto.join(":").split(/[,;]/)) adicionar(parte, parte);
      continue;
    }
    if (soMarcadas && !atual && !NUMERADA.test(linha) && !COM_MARCADOR.test(linha)) continue;
    const partes = linha.includes(",") || linha.includes(";") ? linha.split(/[,;]/) : [linha];
    for (const parte of partes) adicionar(parte, partes.length > 1 ? parte : linha);
  }

  const comGente = times.filter((t) => t.jogadores.length > 0);
  return { nomes, times: comGente.length >= 2 ? comGente : null };
}

/**
 * Acha na turma quem é o nome colado: nome igual, ou primeiro nome igual
 * quando só uma pessoa da turma tem esse primeiro nome.
 */
export function acharMembro<T extends { nome: string }>(membros: T[], nome: string): T | null {
  const chave = chaveNome(nome);
  const exato = membros.find((m) => chaveNome(m.nome) === chave);
  if (exato) return exato;
  if (chave.includes(" ")) return null;
  const porPrimeiroNome = membros.filter((m) => chaveNome(m.nome).split(" ")[0] === chave);
  return porPrimeiroNome.length === 1 ? (porPrimeiroNome[0] ?? null) : null;
}
