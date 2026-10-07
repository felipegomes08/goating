import { Link } from "@tanstack/react-router";
import { CalendarDays, Crown } from "lucide-react";
import type { TurmaResumo } from "@/hooks/use-turmas";
import { cn } from "@/lib/utils";

/**
 * Cartão da turma com a corrida pela artilharia do mês: posição grande,
 * gols e uma barra de quanto falta pra alcançar o líder.
 */
export function CartaoTurma({
  turma,
  className,
  detalhado = false,
}: {
  turma: TurmaResumo;
  className?: string;
  /** mostra selo de dono/admin e a próxima pelada (lista de turmas) */
  detalhado?: boolean;
}) {
  const golsDoLider = turma.artilheiro_gols ?? 0;
  const souLider = turma.minha_posicao === 1 && turma.meus_gols > 0;
  const faltam = Math.max(0, golsDoLider - turma.meus_gols);
  const progresso = golsDoLider > 0 ? Math.min(100, (turma.meus_gols / golsDoLider) * 100) : 0;

  const legenda =
    golsDoLider === 0
      ? turma.peladas === 0
        ? "Nenhuma pelada com placar ainda"
        : "Ninguém marcou esse mês. Quem abre o placar?"
      : souLider
        ? `Você é o artilheiro do mês com ${turma.meus_gols} ${turma.meus_gols === 1 ? "gol" : "gols"}`
        : turma.minha_posicao === null
          ? `${turma.artilheiro} lidera com ${golsDoLider}. Você ainda não jogou esse mês`
          : faltam === 0
            ? `Empatado com ${turma.artilheiro} na artilharia`
            : `${faltam === 1 ? "Falta 1 gol" : `Faltam ${faltam} gols`} pra alcançar ${turma.artilheiro}`;

  return (
    <Link
      to="/turma/$id"
      params={{ id: turma.crew_id }}
      className={cn(
        "block rounded-3xl bg-primary p-4 text-primary-foreground shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-base font-extrabold">
            <span className="truncate">{turma.nome}</span>
            {detalhado && (turma.sou_dono || turma.sou_admin) && (
              <span className="shrink-0 rounded-full bg-primary-foreground/10 px-2 py-0.5 text-[9px] font-bold tracking-wide text-mint">
                {turma.sou_dono ? "DONO" : "ADMIN"}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-primary-foreground/60">
            {turma.membros} {turma.membros === 1 ? "jogador" : "jogadores"} · {turma.peladas}{" "}
            {turma.peladas === 1 ? "pelada" : "peladas"}
          </p>
        </div>

        {turma.minha_posicao !== null && turma.meus_gols > 0 && (
          <div className="shrink-0 text-right">
            <p className="flex items-center justify-end gap-1 text-4xl leading-none font-black text-mint tabular-nums">
              {souLider && <Crown className="size-5 text-tier-ouro" />}
              {turma.minha_posicao}º
            </p>
            <p className="mt-1 text-[9px] font-semibold tracking-wide text-primary-foreground/60 uppercase">
              artilharia do mês
            </p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-primary-foreground/15"
          role="progressbar"
          aria-valuenow={Math.round(progresso)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Seus gols em relação ao artilheiro do mês"
        >
          <div
            className={cn("h-full rounded-full", souLider ? "bg-tier-ouro" : "bg-mint")}
            style={{ width: `${progresso}%` }}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-xs font-medium text-primary-foreground/80">
            {legenda}
          </p>
          {golsDoLider > 0 && (
            <p className="shrink-0 text-xs font-bold text-mint tabular-nums">
              {turma.meus_gols}/{golsDoLider}
            </p>
          )}
        </div>
      </div>

      {detalhado && turma.proxima_data && turma.proxima_horario && (
        <p className="mt-3 flex items-center gap-1.5 border-t border-primary-foreground/10 pt-3 text-xs text-primary-foreground/70">
          <CalendarDays className="size-3.5" />
          Próxima pelada:{" "}
          {new Date(`${turma.proxima_data}T12:00:00`).toLocaleDateString("pt-BR", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
          })}{" "}
          às {turma.proxima_horario.slice(0, 5)}
        </p>
      )}
    </Link>
  );
}
