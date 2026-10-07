import { Link } from "@tanstack/react-router";
import { ChevronDown, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export type LinhaRanking = {
  member_id: string;
  user_id: string | null;
  nome: string;
  jogos: number;
  vitorias: number;
  gols: number;
  /** gols por jogo */
  media: number;
  /** 0 a 100 */
  aproveitamento: number;
};

export type ColunaRanking = "jogos" | "vitorias" | "gols" | "media" | "aproveitamento";

export const COLUNAS_RANKING: { id: ColunaRanking; sigla: string; nome: string }[] = [
  { id: "jogos", sigla: "J", nome: "jogos" },
  { id: "vitorias", sigla: "V", nome: "vitórias" },
  { id: "gols", sigla: "G", nome: "gols" },
  { id: "media", sigla: "M", nome: "gols por jogo" },
  { id: "aproveitamento", sigla: "%", nome: "aproveitamento" },
];

export const formatarMedia = (media: number) => media.toFixed(1).replace(".", ",");

const valorDaColuna = (linha: LinhaRanking, coluna: ColunaRanking) =>
  coluna === "media" ? formatarMedia(linha.media) : String(linha[coluna]);

/** Tabela do ranking da turma. Toque no cabeçalho de uma coluna pra ordenar por ela. */
export function TabelaRanking({
  linhas,
  ordem,
  onOrdenar,
  userId,
}: {
  linhas: LinhaRanking[];
  ordem: ColunaRanking;
  onOrdenar: (coluna: ColunaRanking) => void;
  userId: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-8" />
          <col />
          {COLUNAS_RANKING.map((c) => (
            <col key={c.id} className={c.id === "media" ? "w-11" : "w-9"} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-border text-[11px] text-muted-foreground">
            <th scope="col" className="py-2 pl-2 text-center font-semibold">
              #
            </th>
            <th scope="col" className="py-2 pl-1 text-left font-semibold">
              Jogador
            </th>
            {COLUNAS_RANKING.map((c) => {
              const ativa = ordem === c.id;
              return (
                <th
                  key={c.id}
                  scope="col"
                  aria-sort={ativa ? "descending" : "none"}
                  className={cn("p-0", ativa && "bg-mint-soft")}
                >
                  <button
                    type="button"
                    aria-label={`Ordenar por ${c.nome}`}
                    onClick={() => onOrdenar(c.id)}
                    className={cn(
                      "flex w-full flex-col items-center py-1.5 font-bold",
                      ativa ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {c.sigla}
                    <ChevronDown className={cn("size-3", ativa ? "opacity-100" : "opacity-0")} />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {linhas.map((l, i) => {
            const eu = !!userId && l.user_id === userId;
            return (
              <tr key={l.member_id} className={cn(eu && "bg-mint-soft/60")}>
                <td className="py-2.5 pl-2 text-center">
                  {i === 0 ? (
                    <Crown className="mx-auto size-4 text-tier-ouro" aria-label="1º" />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                  )}
                </td>
                <td className="py-2.5 pr-1 pl-1">
                  {l.user_id ? (
                    <Link
                      to="/jogador/$id"
                      params={{ id: l.user_id }}
                      className={cn(
                        "block truncate text-foreground",
                        eu ? "font-extrabold" : "font-semibold",
                      )}
                    >
                      {l.nome}
                    </Link>
                  ) : (
                    <span className="block truncate font-semibold text-foreground">{l.nome}</span>
                  )}
                </td>
                {COLUNAS_RANKING.map((c) => (
                  <td
                    key={c.id}
                    className={cn(
                      "py-2.5 text-center tabular-nums",
                      ordem === c.id
                        ? "bg-mint-soft font-extrabold text-primary"
                        : "text-foreground/80",
                    )}
                  >
                    {valorDaColuna(l, c.id)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
        {COLUNAS_RANKING.map((c) => `${c.sigla} ${c.nome}`).join(" · ")}. Toque numa coluna pra
        ordenar.
      </p>
    </div>
  );
}
