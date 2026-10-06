import { Link } from "@tanstack/react-router";
import { ChevronRight, Users } from "lucide-react";
import { minhaSituacao, useMinhasTurmas } from "@/hooks/use-turmas";

/** Faixa do topo do feed: as turmas do usuário e como ele está em cada uma no mês. */
export function FaixaTurmas({ userId }: { userId: string }) {
  const turmas = useMinhasTurmas(userId);
  if (!turmas.data) return null;

  if (turmas.data.length === 0) {
    return (
      <Link
        to="/turmas"
        className="flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-[var(--shadow-card)]"
      >
        <Users className="size-6 shrink-0 text-mint" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Crie a turma do seu futebol</span>
          <span className="block text-xs text-mint">
            Placar, artilharia e ranking da galera, toda semana.
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-mint" />
      </Link>
    );
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          Suas turmas
        </h2>
        <Link to="/turmas" className="text-xs font-semibold text-primary">
          Ver todas
        </Link>
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {turmas.data.map((t) => (
          <Link
            key={t.crew_id}
            to="/turma/$id"
            params={{ id: t.crew_id }}
            className="w-64 shrink-0 snap-start rounded-2xl bg-primary p-4 text-primary-foreground shadow-[var(--shadow-card)] last:mr-0"
          >
            <p className="truncate text-base font-extrabold">{t.nome}</p>
            <p className="mt-1 truncate text-xs font-semibold text-mint">{minhaSituacao(t)}</p>
            <p className="mt-3 truncate text-[11px] text-primary-foreground/70">
              {t.artilheiro
                ? `Artilheiro do mês: ${t.artilheiro} (${t.artilheiro_gols})`
                : `${t.membros} ${t.membros === 1 ? "jogador" : "jogadores"}`}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
