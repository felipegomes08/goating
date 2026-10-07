import { Link } from "@tanstack/react-router";
import { ChevronRight, Users } from "lucide-react";
import { useMinhasTurmas } from "@/hooks/use-turmas";
import { CartaoTurma } from "@/components/goating/cartao-turma";

/** Faixa do topo do feed: as turmas do usuário e como ele está em cada uma no mês. */
export function FaixaTurmas({ userId }: { userId: string }) {
  const turmas = useMinhasTurmas(userId);
  if (!turmas.data) return null;

  if (turmas.data.length === 0) {
    return (
      <Link
        to="/turmas"
        className="flex items-center gap-3 rounded-3xl bg-primary p-4 text-primary-foreground shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]"
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

  const varias = turmas.data.length > 1;

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
      {/* rolagem lateral sem barra visível: o cartão seguinte aparecendo pela metade já avisa que tem mais */}
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {turmas.data.map((t) => (
          <CartaoTurma
            key={t.crew_id}
            turma={t}
            className={varias ? "w-[84%] shrink-0 snap-start" : "w-full"}
          />
        ))}
      </div>
    </section>
  );
}
