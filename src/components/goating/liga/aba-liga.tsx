import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Lock, Plus, Trophy } from "lucide-react";
import { useLigasDaTurma, useRodadasDaLiga, useTabelaDaLiga } from "@/hooks/use-ligas";
import { usePremium } from "@/hooks/use-premium";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CabecalhoDaLiga } from "@/components/goating/liga/cabecalho-da-liga";
import { LideresDaLiga, TabelaDaLiga } from "@/components/goating/liga/tabela-da-liga";
import { FolhaLiga } from "@/components/goating/liga/folha-liga";
import { periodoDaLiga, situacaoDaLiga } from "@/lib/ligas";

/** Quantas linhas da tabela aparecem na aba (a tabela inteira fica na tela da liga). */
const LINHAS_NA_ABA = 8;

/**
 * Aba "Liga" da turma: a liga que está rolando (ou marcada), com a tabela e os líderes; o botão
 * de criar pro dono/ADM (Premium); e o hall da fama com as ligas que já acabaram.
 */
export function AbaLiga({
  crewId,
  souGestor,
  userId,
}: {
  crewId: string;
  souGestor: boolean;
  userId: string | null;
}) {
  const navigate = useNavigate();
  const { premium } = usePremium();
  const ligas = useLigasDaTurma(crewId);
  const [criando, setCriando] = useState(false);

  const lista = ligas.data?.ligas ?? [];
  const atual = lista.find((l) => situacaoDaLiga(l) !== "encerrada") ?? null;
  const passadas = lista.filter((l) => situacaoDaLiga(l) === "encerrada");
  const tabela = useTabelaDaLiga(atual && situacaoDaLiga(atual) === "rolando" ? atual.id : null);
  const rodadas = useRodadasDaLiga(atual);

  if (ligas.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-4">
      {atual ? (
        <>
          <Link to="/liga/$id" params={{ id: atual.id }} className="block">
            <CabecalhoDaLiga liga={atual} rodadas={rodadas.data ?? 0} />
          </Link>
          {situacaoDaLiga(atual) === "rolando" &&
            (tabela.isLoading ? (
              <Skeleton className="h-48 w-full rounded-2xl" />
            ) : (
              <>
                <TabelaDaLiga
                  linhas={(tabela.data ?? []).slice(0, LINHAS_NA_ABA)}
                  userId={userId}
                />
                {(tabela.data?.length ?? 0) > LINHAS_NA_ABA && (
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/liga/$id" params={{ id: atual.id }}>
                      Ver a tabela inteira
                    </Link>
                  </Button>
                )}
                <LideresDaLiga linhas={tabela.data ?? []} />
              </>
            ))}
          {situacaoDaLiga(atual) === "futura" && (
            <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
              A liga começa dia {new Date(`${atual.inicio}T12:00:00`).toLocaleDateString("pt-BR")}.
              A tabela abre na primeira pelada com placar.
            </p>
          )}
        </>
      ) : (
        <div className="rounded-3xl bg-card p-5 text-center shadow-[var(--shadow-card)]">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-tier-ouro/15">
            <Trophy className="size-7 text-tier-ouro" />
          </span>
          <p className="mt-3 text-base font-extrabold text-foreground">Nenhuma liga rolando</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Uma liga é uma temporada da turma: um período com tabela própria e, no fim, campeão,
            artilheiro, garçom e outros troféus.
          </p>
          {souGestor &&
            (premium ? (
              <Button className="mt-4 w-full" onClick={() => setCriando(true)}>
                <Plus className="mr-2 size-4" /> Criar liga
              </Button>
            ) : (
              <Button
                className="mt-4 w-full bg-tier-ouro font-bold text-primary hover:bg-tier-ouro/90"
                onClick={() =>
                  void navigate({ to: "/premium", search: { recurso: "Criar ligas" } })
                }
              >
                <Lock className="mr-2 size-4" /> Criar liga · Premium
              </Button>
            ))}
        </div>
      )}

      {passadas.length > 0 && (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Hall da fama
          </h3>
          <div className="divide-y divide-border rounded-2xl bg-card shadow-[var(--shadow-card)]">
            {passadas.map((l) => {
              const premios = (ligas.data?.premios ?? []).filter((p) => p.liga_id === l.id);
              const nomes = (c: string) =>
                premios
                  .filter((p) => p.categoria === c)
                  .map((p) => p.nome.split(" ")[0])
                  .join(", ");
              return (
                <Link
                  key={l.id}
                  to="/liga/$id"
                  params={{ id: l.id }}
                  className="flex items-center gap-3 px-3 py-3"
                >
                  <span className="text-xl">🏆</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-foreground">
                      {l.nome}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {periodoDaLiga(l)}
                      {nomes("campeao") && ` · Campeão: ${nomes("campeao")}`}
                      {nomes("artilheiro") && ` · Artilheiro: ${nomes("artilheiro")}`}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {criando && <FolhaLiga crewId={crewId} onFechar={() => setCriando(false)} />}
    </div>
  );
}
