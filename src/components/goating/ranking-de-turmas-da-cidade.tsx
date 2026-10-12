import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MIN_AVALIACOES_DA_TURMA } from "@/components/goating/avaliacoes-da-turma";
import { Skeleton } from "@/components/ui/skeleton";
import { urlDaMiniaturaDoEscudo, urlDaFotoDaTurma } from "@/lib/foto-turma";
import { cn } from "@/lib/utils";

const COR_DO_PODIO = ["text-tier-ouro", "text-tier-prata", "text-tier-bronze"];

/**
 * Turmas da cidade, da mais bem avaliada pra menos. Quem ainda não tem o mínimo de
 * avaliações aparece depois, sem posição. Tocar numa turma abre a página dela, onde
 * dá pra pedir pra entrar.
 */
export function RankingDeTurmasDaCidade({ cidade }: { cidade: string }) {
  const turmas = useQuery({
    queryKey: ["ranking-turmas", cidade],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ranking_de_turmas", { p_cidade: cidade });
      if (error) throw error;
      return data;
    },
  });

  if (turmas.isLoading) {
    return (
      <>
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </>
    );
  }
  const lista = turmas.data ?? [];
  if (lista.length === 0) {
    return (
      <p className="pt-10 text-center text-sm text-muted-foreground">
        Ainda não tem turma em {cidade}. Crie a sua na aba Turmas.
      </p>
    );
  }

  let posicao = 0;
  return (
    <>
      {lista.map((t) => {
        const noRanking = t.avaliacoes >= MIN_AVALIACOES_DA_TURMA && t.nota !== null;
        if (noRanking) posicao += 1;
        const lugar = noRanking ? posicao : null;
        return (
          <Link
            key={t.crew_id}
            to="/turma/$id"
            params={{ id: t.crew_id }}
            search={{ aba: "notas" }}
            className={cn(
              "flex items-center gap-3 rounded-3xl bg-card p-3 shadow-[var(--shadow-card)] active:opacity-60",
              t.sou_membro && "ring-2 ring-mint ring-offset-2 ring-offset-background",
            )}
          >
            <span
              className={cn(
                "w-6 shrink-0 text-center font-black tabular-nums",
                lugar && lugar <= 3 ? "text-lg" : "text-sm",
                lugar ? (COR_DO_PODIO[lugar - 1] ?? "text-muted-foreground") : "text-border",
              )}
            >
              {lugar ?? "·"}
            </span>
            <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary">
              {t.escudo_url ? (
                <img
                  src={urlDaMiniaturaDoEscudo(t.escudo_url) ?? undefined}
                  alt=""
                  loading="lazy"
                  // escudo antigo, enviado sem miniatura: usa a foto inteira
                  onError={(e) => {
                    const inteira = urlDaFotoDaTurma(t.escudo_url);
                    if (inteira && e.currentTarget.src !== inteira) e.currentTarget.src = inteira;
                  }}
                  className="size-full object-cover"
                />
              ) : (
                <Users className="size-5 text-mint" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold text-foreground">
                {t.nome}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {t.membros} {t.membros === 1 ? "jogador" : "jogadores"} · {t.peladas}{" "}
                {t.peladas === 1 ? "pelada" : "peladas"}
              </span>
              <span className="mt-0.5 block truncate text-[11px] font-semibold text-foreground/70">
                {t.sou_membro
                  ? "Você joga aqui"
                  : t.aceita_pedidos
                    ? "Aceita pedidos de entrada"
                    : "Fechada pra pedidos"}
              </span>
            </span>
            <span className="flex w-12 shrink-0 flex-col items-center">
              <span className="flex size-[42px] items-center justify-center rounded-xl bg-secondary text-base font-black text-foreground tabular-nums">
                {noRanking ? Number(t.nota).toFixed(1).replace(".", ",") : "—"}
              </span>
              <span className="mt-0.5 text-[9px] font-bold text-muted-foreground uppercase">
                {noRanking ? "nota" : "sem nota"}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        );
      })}
    </>
  );
}
