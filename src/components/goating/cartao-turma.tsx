import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Crown, Users } from "lucide-react";
import type { TurmaResumo } from "@/hooks/use-turmas";
import { cn } from "@/lib/utils";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "hoje às 19:30", "amanhã às 19:30" ou "qui, 15/10 às 19:30". */
function quando(data: string, horario: string) {
  const dia = new Date(`${data}T12:00:00`);
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const distancia = Math.round((dia.getTime() - hoje.getTime()) / 86_400_000);
  const rotulo =
    distancia === 0
      ? "hoje"
      : distancia === 1
        ? "amanhã"
        : `${SEMANA[dia.getDay()]}, ${String(dia.getDate()).padStart(2, "0")}/${String(dia.getMonth() + 1).padStart(2, "0")}`;
  return { hoje: distancia === 0, texto: `${rotulo} às ${horario.slice(0, 5)}` };
}

/** Cartão da turma: como você está no mês, quem é o artilheiro e quando é a próxima pelada. */
export function CartaoTurma({ turma }: { turma: TurmaResumo }) {
  const jogouNoMes = turma.minha_posicao !== null;
  const proxima =
    turma.proxima_data && turma.proxima_horario
      ? quando(turma.proxima_data, turma.proxima_horario)
      : null;

  return (
    <Link
      to="/turma/$id"
      params={{ id: turma.crew_id }}
      className="block overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]"
    >
      <div className="flex items-center gap-3 p-4 pb-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary">
          <Users className="size-5 text-mint" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5">
            <span className="truncate text-base font-extrabold text-foreground">{turma.nome}</span>
            {(turma.sou_dono || turma.sou_admin) && (
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[9px] font-bold tracking-wide text-muted-foreground">
                {turma.sou_dono ? "DONO" : "ADMIN"}
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {turma.membros} {turma.membros === 1 ? "jogador" : "jogadores"} · {turma.peladas}{" "}
            {turma.peladas === 1 ? "pelada com placar" : "peladas com placar"}
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </div>

      <div className="px-4">
        <p className="mb-1.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
          Este mês
        </p>
        <div className="grid grid-cols-[1fr_1fr_1.6fr] gap-2">
          <Numero rotulo="Sua posição" valor={jogouNoMes ? `${turma.minha_posicao}º` : "—"} />
          <Numero rotulo="Seus gols" valor={jogouNoMes ? String(turma.meus_gols) : "—"} />
          <Numero
            rotulo="Artilheiro"
            destaque
            valor={
              turma.artilheiro ? (
                <span className="flex items-center gap-1">
                  <Crown className="size-3.5 shrink-0 text-tier-ouro" />
                  <span className="truncate">{turma.artilheiro}</span>
                  <span className="shrink-0 text-muted-foreground">· {turma.artilheiro_gols}</span>
                </span>
              ) : (
                "ninguém ainda"
              )
            }
          />
        </div>
      </div>

      <p
        className={cn(
          "mt-3 flex items-center gap-2 px-4 py-2.5 text-xs font-semibold",
          proxima?.hoje
            ? "bg-mint text-mint-foreground"
            : proxima
              ? "bg-mint-soft text-primary"
              : "bg-secondary/60 text-muted-foreground",
        )}
      >
        <CalendarDays className="size-4 shrink-0" />
        {proxima ? (
          <span>
            Próxima pelada: <span className="font-extrabold">{proxima.texto}</span>
          </span>
        ) : (
          "Nenhuma pelada marcada"
        )}
      </p>
    </Link>
  );
}

function Numero({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: ReactNode;
  /** texto em vez de número grande (nome do artilheiro) */
  destaque?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-secondary/60 px-2.5 py-2">
      <p className="truncate text-[10px] font-semibold text-muted-foreground">{rotulo}</p>
      <div
        className={cn(
          "mt-0.5 truncate font-extrabold text-foreground tabular-nums",
          destaque ? "text-sm leading-7" : "text-xl leading-7",
        )}
      >
        {valor}
      </div>
    </div>
  );
}
