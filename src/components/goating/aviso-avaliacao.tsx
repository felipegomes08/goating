import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { estaPendenteAvaliacao, type PeladaFeed } from "@/components/goating/match-card";
import { fimDaJanela } from "@/lib/janela-avaliacao";
import { cn } from "@/lib/utils";

/** Peladas que eu joguei, com a janela aberta, e ainda falta alguém pra eu avaliar. */
export const pendentesDeAvaliacao = (peladas: PeladaFeed[]) =>
  peladas.filter(
    (p) =>
      estaPendenteAvaliacao(p) &&
      p.minhaSituacao === "aprovado" &&
      p.confirmados > 1 &&
      !p.jaAvaliei,
  );

/** "hoje", "ontem" ou "seg, 23/11" */
function quando(data: string) {
  const dia = new Date(`${data}T12:00:00`);
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const distancia = Math.round((hoje.getTime() - dia.getTime()) / 86_400_000);
  if (distancia === 0) return "hoje";
  if (distancia === 1) return "ontem";
  return dia.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

/**
 * Aviso fixo de "falta avaliar": no topo do feed e da turma, pra ninguém ficar procurando onde
 * está a pelada que acabou. Some quando avaliou todo mundo ou a janela fecha.
 */
export function AvisosDeAvaliacao({
  peladas,
  className,
}: {
  peladas: PeladaFeed[];
  className?: string;
}) {
  if (peladas.length === 0) return null;
  return (
    <div className={cn("space-y-2", className)}>
      {peladas.map((p) => {
        const faltam = p.avaliados.total - p.avaliados.feitos;
        const fim = fimDaJanela(p);
        return (
          <Link
            key={p.id}
            to="/pelada/$id/avaliar"
            params={{ id: p.id }}
            className="flex items-center gap-3 rounded-2xl border-2 border-tier-ouro bg-tier-ouro/10 p-3 active:scale-[0.99]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tier-ouro">
              <Star className="size-5 fill-primary text-primary" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold text-foreground">
                Falta avaliar · {p.titulo} ({quando(p.data)})
              </span>
              <span className="block text-xs text-muted-foreground">
                {faltam === 1 ? "Falta 1 jogador" : `Faltam ${faltam} jogadores`}
                {fim &&
                  ` · até ${fim.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
              </span>
            </span>
            <span className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
              Avaliar
            </span>
          </Link>
        );
      })}
    </div>
  );
}
