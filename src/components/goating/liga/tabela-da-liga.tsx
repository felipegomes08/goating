import { Link } from "@tanstack/react-router";
import type { LinhaDaLiga } from "@/hooks/use-ligas";
import { CATEGORIAS, ORDEM_DAS_CATEGORIAS } from "@/lib/ligas";
import { cn } from "@/lib/utils";

export type ColunaDaLiga =
  "pontos" | "peladas" | "vitorias" | "empates" | "gols" | "assistencias" | "mvps";

export const COLUNAS_DA_LIGA: { id: ColunaDaLiga; sigla: string; nome: string }[] = [
  { id: "pontos", sigla: "P", nome: "pontos" },
  { id: "peladas", sigla: "J", nome: "peladas jogadas" },
  { id: "vitorias", sigla: "V", nome: "vitórias" },
  { id: "empates", sigla: "E", nome: "empates" },
  { id: "gols", sigla: "G", nome: "gols" },
  { id: "assistencias", sigla: "A", nome: "assistências" },
  { id: "mvps", sigla: "MVP", nome: "MVPs" },
];

/**
 * Linhas na ordem da coluna escolhida. Em "pontos" vale a posição oficial do servidor; nas
 * outras, maior primeiro, com desempate pela posição na liga.
 */
export function ordenarLiga(linhas: LinhaDaLiga[], ordem: ColunaDaLiga) {
  return [...linhas].sort((a, b) =>
    ordem === "pontos" ? a.posicao - b.posicao : b[ordem] - a[ordem] || a.posicao - b.posicao,
  );
}

/**
 * Tabela da liga: posição, pontos e os números que contam. Com `onOrdenar`, tocar numa coluna
 * ordena por ela. A linha de quem está vendo fica destacada.
 */
export function TabelaDaLiga({
  linhas,
  userId,
  ordem = "pontos",
  onOrdenar,
}: {
  linhas: LinhaDaLiga[];
  userId: string | null;
  ordem?: ColunaDaLiga;
  onOrdenar?: (coluna: ColunaDaLiga) => void;
}) {
  if (linhas.length === 0) {
    return (
      <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
        Nenhuma pelada com placar na liga ainda. A tabela começa na primeira.
      </p>
    );
  }
  const ordenadas = ordenarLiga(linhas, ordem);
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] text-muted-foreground uppercase">
            <th className="w-8 py-2 font-semibold">#</th>
            <th className="text-left font-semibold">Jogador</th>
            {COLUNAS_DA_LIGA.map((c) => (
              <th
                key={c.id}
                className={cn(
                  c.id === "mvps" ? "w-9 pr-2" : c.id === "pontos" ? "w-9" : "w-7",
                  ordem === c.id ? "bg-mint-soft font-extrabold text-primary" : "font-semibold",
                )}
              >
                {onOrdenar ? (
                  <button
                    type="button"
                    aria-label={`Ordenar por ${c.nome}`}
                    aria-pressed={ordem === c.id}
                    onClick={() => onOrdenar(c.id)}
                    className="w-full py-2 uppercase"
                  >
                    {c.sigla}
                  </button>
                ) : (
                  c.sigla
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {ordenadas.map((l, i) => {
            const lugar = ordem === "pontos" ? l.posicao : i + 1;
            return (
              <tr
                key={l.member_id}
                className={cn(
                  "text-center tabular-nums",
                  l.user_id === userId && "bg-mint-soft/70 font-bold",
                  lugar === 1 && "bg-tier-ouro/10",
                )}
              >
                <td className="py-2 text-xs font-bold text-muted-foreground">
                  {lugar === 1 ? "👑" : lugar}
                </td>
                <td className="max-w-0 truncate text-left font-semibold text-foreground">
                  {l.user_id ? (
                    <Link to="/jogador/$id" params={{ id: l.user_id }}>
                      {l.nome}
                    </Link>
                  ) : (
                    l.nome
                  )}
                </td>
                {COLUNAS_DA_LIGA.map((c) => (
                  <td
                    key={c.id}
                    className={cn(
                      c.id === "mvps" && "pr-2",
                      c.id === "pontos" && "font-black text-primary",
                      ordem === c.id && "bg-mint-soft/60 font-extrabold",
                    )}
                  >
                    {l[c.id]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
        P pontos · J peladas jogadas · V vitórias · E empates · G gols · A assistências
        {onOrdenar ? " · toque numa coluna pra ordenar" : ""}
      </p>
    </div>
  );
}

/** Quem lidera cada categoria agora (durante a liga). Empate: todos aparecem. */
export function LideresDaLiga({ linhas }: { linhas: LinhaDaLiga[] }) {
  const cards = ORDEM_DAS_CATEGORIAS.filter((c) => c !== "campeao").flatMap((c) => {
    const campo = CATEGORIAS[c].campo as keyof LinhaDaLiga;
    const maximo = Math.max(0, ...linhas.map((l) => Number(l[campo])));
    if (maximo === 0) return [];
    const nomes = linhas
      .filter((l) => Number(l[campo]) === maximo)
      .map((l) => l.nome.split(" ")[0]);
    return [{ categoria: c, nomes, valor: maximo }];
  });
  if (cards.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map(({ categoria, nomes, valor }) => {
        const { rotulo, icone: Icone, unidade } = CATEGORIAS[categoria];
        return (
          <div key={categoria} className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
            <p className="flex items-center gap-1 text-[10px] font-extrabold tracking-wide text-muted-foreground uppercase">
              <Icone className="size-3.5 text-primary" /> {rotulo}
            </p>
            <p className="mt-1 truncate text-sm font-extrabold text-foreground">
              {nomes.join(", ")}
            </p>
            <p className="text-[11px] text-muted-foreground">{unidade(valor)}</p>
          </div>
        );
      })}
    </div>
  );
}
