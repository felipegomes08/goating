import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Users } from "lucide-react";
import {
  PERIODOS,
  rotuloDoPeriodo,
  useMinhasTurmas,
  useRankingDaTurma,
  type Periodo,
} from "@/hooks/use-turmas";
import {
  COLUNA_GRATIS,
  PeriodosDoRanking,
  TabelaRanking,
  type ColunaRanking,
} from "@/components/goating/tabela-ranking";
import { FolhaPremium } from "@/components/goating/cadeado";
import { usePremium } from "@/hooks/use-premium";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Aba "Turma" do ranking: escolhe uma das suas turmas e vê a tabela dela
 * (jogos, vitórias, gols, média e aproveitamento).
 */
export function RankingDeTurma({
  userId,
  turmaId,
  onEscolher,
}: {
  userId: string;
  /** turma escolhida (vem da URL); sem nenhuma, vale a primeira da lista */
  turmaId: string | undefined;
  onEscolher: (crewId: string) => void;
}) {
  const turmas = useMinhasTurmas(userId);
  const { premium } = usePremium();
  const [periodoEscolhido, setPeriodo] = useState<Periodo>("mes");
  const [ordemEscolhida, setOrdem] = useState<ColunaRanking>("vitorias");
  const [bloqueio, setBloqueio] = useState<string | null>(null);
  // sem Premium o ranking fica em vitórias, desde o começo
  const periodo: Periodo = premium ? periodoEscolhido : "tudo";
  const ordem: ColunaRanking = premium ? ordemEscolhida : COLUNA_GRATIS;

  const escolhida =
    (turmas.data ?? []).find((t) => t.crew_id === turmaId) ?? turmas.data?.[0] ?? null;
  const ranking = useRankingDaTurma(escolhida?.crew_id ?? null, periodo);
  const linhas = [...(ranking.data ?? [])].sort(
    (a, b) =>
      b[ordem] - a[ordem] ||
      // desempate: vitórias, depois gols
      b.vitorias - a.vitorias ||
      b.gols - a.gols ||
      a.nome.localeCompare(b.nome),
  );

  if (turmas.isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  if (!escolhida) {
    return (
      <div className="mt-10 flex flex-col items-center px-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-mint-soft">
          <Users className="size-7 text-primary" strokeWidth={1.8} />
        </span>
        <p className="mt-4 text-base font-semibold text-foreground">
          Você ainda não está em nenhuma turma
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie a do seu futebol, ou peça o link da turma pra quem organiza.
        </p>
        <Button asChild className="mt-4">
          <Link to="/turmas">Ir pra Turmas</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(turmas.data ?? []).length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(turmas.data ?? []).map((t) => {
            const ativa = t.crew_id === escolhida.crew_id;
            return (
              <button
                key={t.crew_id}
                type="button"
                aria-pressed={ativa}
                onClick={() => onEscolher(t.crew_id)}
                className={cn(
                  "max-w-[70%] shrink-0 truncate rounded-full px-4 py-2 text-xs font-bold transition-colors",
                  ativa
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground shadow-[var(--shadow-card)]",
                )}
              >
                {t.nome}
              </button>
            );
          })}
        </div>
      )}

      <PeriodosDoRanking
        opcoes={PERIODOS}
        valor={periodo}
        onMudar={setPeriodo}
        premium={premium}
        livre="tudo"
        onBloqueado={() => setBloqueio("Ranking do mês e do ano")}
      />

      {ranking.isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : linhas.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
          Nenhuma pelada com placar em {escolhida.nome} nesse período ({rotuloDoPeriodo(periodo)}
          ).
        </p>
      ) : (
        <TabelaRanking
          linhas={linhas}
          ordem={ordem}
          onOrdenar={setOrdem}
          userId={userId}
          premium={premium}
          onBloqueado={() => setBloqueio("Ordenar o ranking")}
        />
      )}
      {bloqueio && <FolhaPremium recurso={bloqueio} onFechar={() => setBloqueio(null)} />}

      <Link
        to="/turma/$id"
        params={{ id: escolhida.crew_id }}
        className="flex items-center justify-center gap-1 py-2 text-xs font-semibold text-primary"
      >
        Abrir a turma {escolhida.nome} <ChevronRight className="size-3.5" />
      </Link>
    </div>
  );
}
