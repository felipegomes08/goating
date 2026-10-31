import { Link } from "@tanstack/react-router";
import { ChevronDown, Crown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type LinhaRanking = {
  member_id: string;
  user_id: string | null;
  nome: string;
  jogos: number;
  vitorias: number;
  gols: number;
  assistencias: number;
  mvps: number;
  /** gols por jogo */
  media: number;
  /** 0 a 100 */
  aproveitamento: number;
};

export type ColunaRanking =
  "jogos" | "vitorias" | "gols" | "assistencias" | "mvps" | "media" | "aproveitamento";

/** Sem Premium, o ranking da turma fica nessa coluna (e no período "Tudo"). */
export const COLUNA_GRATIS: ColunaRanking = "vitorias";

export const COLUNAS_RANKING: { id: ColunaRanking; sigla: string; nome: string }[] = [
  { id: "jogos", sigla: "J", nome: "jogos" },
  { id: "vitorias", sigla: "V", nome: "vitórias" },
  { id: "gols", sigla: "G", nome: "gols" },
  { id: "assistencias", sigla: "A", nome: "assistências" },
  { id: "mvps", sigla: "MVP", nome: "MVPs" },
  { id: "media", sigla: "M", nome: "gols por jogo" },
  { id: "aproveitamento", sigla: "%", nome: "aproveitamento" },
];

export const formatarMedia = (media: number) => media.toFixed(1).replace(".", ",");

const valorDaColuna = (linha: LinhaRanking, coluna: ColunaRanking) =>
  coluna === "media" ? formatarMedia(linha.media) : String(linha[coluna]);

/**
 * Tabela do ranking da turma. Toque no cabeçalho de uma coluna pra ordenar por ela. Sem
 * Premium, só a coluna de vitórias ordena: as outras mostram o cadeado e chamam `onBloqueado`.
 */
export function TabelaRanking({
  linhas,
  ordem,
  onOrdenar,
  userId,
  premium = true,
  onBloqueado,
  posicoesAntes,
}: {
  linhas: LinhaRanking[];
  ordem: ColunaRanking;
  onOrdenar: (coluna: ColunaRanking) => void;
  userId: string | null;
  premium?: boolean;
  onBloqueado?: () => void;
  /** posição de cada jogador (member_id) antes da última pelada: vira a setinha de subiu/caiu */
  posicoesAntes?: Map<string, number> | null | undefined;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-8" />
          <col />
          {COLUNAS_RANKING.map((c) => (
            <col key={c.id} className={c.id === "media" ? "w-10" : "w-8"} />
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
              const trancada = !premium && c.id !== COLUNA_GRATIS;
              return (
                <th
                  key={c.id}
                  scope="col"
                  aria-sort={ativa ? "descending" : "none"}
                  className={cn("p-0", ativa && "bg-mint-soft")}
                >
                  <button
                    type="button"
                    aria-label={
                      trancada ? `Ordenar por ${c.nome}: Premium` : `Ordenar por ${c.nome}`
                    }
                    onClick={() => (trancada ? onBloqueado?.() : onOrdenar(c.id))}
                    className={cn(
                      "flex w-full flex-col items-center py-1.5 font-bold",
                      ativa ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {c.sigla}
                    {trancada ? (
                      <Lock className="size-2.5 text-tier-ouro" />
                    ) : (
                      <ChevronDown className={cn("size-3", ativa ? "opacity-100" : "opacity-0")} />
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {linhas.map((l, i) => {
            const eu = !!userId && l.user_id === userId;
            const antes = posicoesAntes?.get(l.member_id);
            const variacao = posicoesAntes ? (antes ? antes - (i + 1) : null) : undefined;
            return (
              <tr key={l.member_id} className={cn(eu && "bg-mint-soft/60")}>
                <td className="py-2.5 pl-2 text-center">
                  {i === 0 ? (
                    <Crown className="mx-auto size-4 text-tier-ouro" aria-label="1º" />
                  ) : (
                    <span className="block text-xs font-bold text-muted-foreground">{i + 1}</span>
                  )}
                  {variacao !== undefined && (
                    <span
                      className={cn(
                        "block text-[9px] leading-none font-extrabold",
                        variacao === null
                          ? "text-primary"
                          : variacao > 0
                            ? "text-emerald-600"
                            : variacao < 0
                              ? "text-destructive"
                              : "text-muted-foreground",
                      )}
                      aria-label={
                        variacao === null
                          ? "novo no ranking"
                          : variacao > 0
                            ? `subiu ${variacao}`
                            : variacao < 0
                              ? `caiu ${-variacao}`
                              : "manteve"
                      }
                    >
                      {variacao === null
                        ? "novo"
                        : variacao > 0
                          ? `▲${variacao}`
                          : variacao < 0
                            ? `▼${-variacao}`
                            : "–"}
                    </span>
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
        {COLUNAS_RANKING.map((c) => `${c.sigla} ${c.nome}`).join(" · ")}.{" "}
        {posicoesAntes && "Setinhas: comparando com antes da última pelada. "}
        {premium ? (
          "Toque numa coluna pra ordenar."
        ) : (
          <button
            type="button"
            onClick={onBloqueado}
            className="font-bold text-tier-ouro underline"
          >
            Ordenar pelas outras colunas é Premium
          </button>
        )}
      </p>
    </div>
  );
}

/**
 * Mês, Ano e Tudo do ranking da turma. Sem Premium, só o período `livre` abre: os outros
 * mostram o cadeado e chamam `onBloqueado`.
 */
export function PeriodosDoRanking<T extends string>({
  opcoes,
  valor,
  onMudar,
  premium,
  livre,
  onBloqueado,
}: {
  opcoes: { id: T; rotulo: string }[];
  valor: T;
  onMudar: (valor: T) => void;
  premium: boolean;
  livre: T;
  onBloqueado: () => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-foreground/[0.06] p-1">
      {opcoes.map((o) => {
        const trancado = !premium && o.id !== livre;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={valor === o.id}
            onClick={() => (trancado ? onBloqueado() : onMudar(o.id))}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold transition-colors",
              valor === o.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {o.rotulo}
            {trancado && <Lock className="size-3 text-tier-ouro" />}
          </button>
        );
      })}
    </div>
  );
}
