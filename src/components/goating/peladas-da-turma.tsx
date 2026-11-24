import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, Crown, MapPin, Star, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AoVivoNoCard } from "@/components/goating/match-card";
import { corDoTime, nomeDoTime } from "@/lib/placar/estado";
import { cn } from "@/lib/utils";

export type PeladaDaTurma = {
  id: string;
  titulo: string;
  data: string;
  horario: string;
  status: string;
  local?: string | null;
  placar_finalizado_em: string | null;
};

const RECENTES = 3;
const PROXIMAS_VISIVEIS = 3;

/** "qui, 26/11" */
const diaCurto = (data: string) =>
  new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

/** "hoje", "ontem", "amanhã" ou "qui, 26/11" */
function quando(data: string) {
  const dia = new Date(`${data}T12:00:00`);
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const distancia = Math.round((dia.getTime() - hoje.getTime()) / 86_400_000);
  if (distancia === 0) return "hoje";
  if (distancia === -1) return "ontem";
  if (distancia === 1) return "amanhã";
  return diaCurto(data);
}

/** Placar e MVP das peladas que acabaram de rolar (só as poucas que aparecem em cards). */
function useResultados(ids: string[]) {
  return useQuery({
    queryKey: ["turma-resultados", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(
          "id, nomes_times, cores_times, mvp_id, games(ordem, time_a, time_b, gols_a, gols_b)",
        )
        .in("id", ids);
      if (error) throw error;
      const mvps = data.flatMap((m) => (m.mvp_id ? [m.mvp_id] : []));
      const { data: perfis } = mvps.length
        ? await supabase.from("profiles").select("id, nome_exibicao").in("id", mvps)
        : { data: [] as { id: string; nome_exibicao: string }[] };
      return new Map(
        data.map((m) => [
          m.id,
          {
            ...m,
            games: [...(m.games ?? [])].sort((a, b) => a.ordem - b.ordem),
            mvp: (perfis ?? []).find((p) => p.id === m.mvp_id)?.nome_exibicao ?? null,
          },
        ]),
      );
    },
  });
}

/**
 * Aba "Peladas" da turma, do que importa agora pro que já passou: a que está rolando (ou a
 * próxima), as que acabaram de rolar com placar e MVP, as próximas e o histórico por mês.
 */
export function PeladasDaTurma({
  peladas,
  faltaAvaliar,
}: {
  /** da mais nova pra mais antiga */
  peladas: PeladaDaTurma[];
  /** ids das peladas em que eu ainda tenho nota pra dar */
  faltaAvaliar: Set<string>;
}) {
  const [todasProximas, setTodasProximas] = useState(false);

  const abertas = peladas
    // agendada que já passou da hora (pendente) continua aqui até alguém decidir
    .filter((p) => p.status === "agendada" || p.status === "em_andamento")
    .reverse();
  const rolando = abertas.find((p) => p.status === "em_andamento");
  const destaque = rolando ?? abertas[0];
  const proximas = abertas.filter((p) => p.id !== destaque?.id);
  const finalizadas = peladas.filter((p) => p.status === "finalizada");
  const recentes = finalizadas.slice(0, RECENTES);
  const historico = finalizadas.slice(RECENTES);
  const resultados = useResultados(recentes.filter((p) => p.placar_finalizado_em).map((p) => p.id));

  // histórico em blocos por mês: "novembro de 2026 · 6 peladas"
  const meses: { chave: string; rotulo: string; peladas: PeladaDaTurma[] }[] = [];
  for (const p of historico) {
    const chave = p.data.slice(0, 7);
    let mes = meses.find((m) => m.chave === chave);
    if (!mes) {
      mes = {
        chave,
        rotulo: new Date(`${chave}-15T12:00:00`).toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        }),
        peladas: [],
      };
      meses.push(mes);
    }
    mes.peladas.push(p);
  }

  return (
    <div className="space-y-5">
      {destaque && (
        <section className="space-y-2">
          <Titulo>{rolando ? "Rolando agora" : "Próxima pelada"}</Titulo>
          <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]">
            <Link
              to="/pelada/$id"
              params={{ id: destaque.id }}
              className="flex items-center gap-3 p-4 active:bg-secondary/50"
            >
              <span className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-primary py-1.5 text-primary-foreground">
                <span className="text-[10px] font-extrabold uppercase">
                  {quando(destaque.data).split(",")[0]}
                </span>
                <span className="text-xl leading-none font-black tabular-nums">
                  {destaque.data.slice(8, 10)}
                </span>
                <span className="text-[10px] font-bold opacity-80 tabular-nums">
                  {destaque.horario.slice(0, 5)}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-extrabold text-foreground">
                  {destaque.titulo}
                </span>
                {destaque.local && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{destaque.local}</span>
                  </span>
                )}
                {!rolando &&
                  new Date(`${destaque.data}T${destaque.horario}`).getTime() <= Date.now() && (
                    <span className="mt-1 inline-block rounded-full bg-tier-ouro/15 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                      PENDENTE · rolou?
                    </span>
                  )}
              </span>
              <span className="shrink-0 text-xs font-semibold text-primary">Abrir</span>
            </Link>
            {rolando && <AoVivoNoCard matchId={rolando.id} className="px-4 pb-4" />}
          </div>
        </section>
      )}

      {recentes.length > 0 && (
        <section className="space-y-2">
          <Titulo>Acabaram de rolar</Titulo>
          {recentes.map((p) => {
            const resultado = resultados.data?.get(p.id);
            const jogos = resultado?.games ?? [];
            const nome = (t: number) => nomeDoTime(resultado?.nomes_times, t);
            const cor = (t: number) => corDoTime(t, resultado?.cores_times);
            const deve = faltaAvaliar.has(p.id);
            return (
              <Link
                key={p.id}
                to={p.placar_finalizado_em ? "/pelada/$id/resumo" : "/pelada/$id"}
                params={{ id: p.id }}
                className={cn(
                  "block space-y-2 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] active:bg-secondary/50",
                  deve && "ring-2 ring-tier-ouro",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-foreground">
                      {p.titulo}
                    </span>
                    <span className="block text-[11px] text-muted-foreground capitalize">
                      {quando(p.data)} · {p.horario.slice(0, 5)}
                    </span>
                  </span>
                  {deve ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-tier-ouro/15 px-2 py-0.5 text-[10px] font-bold text-tier-ouro">
                      <Star className="size-3" /> AVALIAR
                    </span>
                  ) : !p.placar_finalizado_em ? (
                    <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                      Sem placar
                    </span>
                  ) : null}
                </div>
                {jogos.length === 1 ? (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
                    <span
                      className={cn(
                        "truncate text-right text-sm font-extrabold",
                        cor(jogos[0]!.time_a).texto,
                      )}
                    >
                      {nome(jogos[0]!.time_a)}
                    </span>
                    <span className="text-xl font-black text-foreground tabular-nums">
                      {jogos[0]!.gols_a} × {jogos[0]!.gols_b}
                    </span>
                    <span
                      className={cn("truncate text-sm font-extrabold", cor(jogos[0]!.time_b).texto)}
                    >
                      {nome(jogos[0]!.time_b)}
                    </span>
                  </div>
                ) : jogos.length > 1 ? (
                  <p className="rounded-xl bg-secondary/60 px-3 py-2 text-center text-sm font-bold text-foreground">
                    {jogos.length} jogos · toque pra ver o resumo
                  </p>
                ) : null}
                {resultado?.mvp && (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Crown className="size-3.5 shrink-0 text-tier-ouro" />
                    <span className="truncate">MVP: {resultado.mvp}</span>
                  </p>
                )}
              </Link>
            );
          })}
        </section>
      )}

      {proximas.length > 0 && (
        <section className="space-y-2">
          <Titulo>Próximas</Titulo>
          <Lista
            peladas={todasProximas ? proximas : proximas.slice(0, PROXIMAS_VISIVEIS)}
            destino="pelada"
          />
          {proximas.length > PROXIMAS_VISIVEIS && (
            <button
              type="button"
              onClick={() => setTodasProximas((v) => !v)}
              className="w-full py-1 text-xs font-semibold text-primary"
            >
              {todasProximas ? "Ver menos" : `Ver todas (${proximas.length})`}
            </button>
          )}
        </section>
      )}

      {meses.length > 0 && (
        <section className="space-y-2">
          <Titulo>Histórico</Titulo>
          {meses.map((m) => (
            <details
              key={m.chave}
              className="group overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-bold text-foreground capitalize">{m.rotulo}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {m.peladas.length} {m.peladas.length === 1 ? "pelada" : "peladas"}
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <div className="border-t border-border">
                <Lista peladas={m.peladas} destino="resumo" plana />
              </div>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}

function Titulo({ children }: { children: string }) {
  return (
    <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{children}</h2>
  );
}

function Lista({
  peladas,
  destino,
  plana = false,
}: {
  peladas: PeladaDaTurma[];
  destino: "pelada" | "resumo";
  /** sem a caixa em volta (já está dentro de uma) */
  plana?: boolean;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border",
        !plana && "rounded-2xl bg-card shadow-[var(--shadow-card)]",
      )}
    >
      {peladas.map((p) => {
        const comPlacar = destino === "resumo" && !!p.placar_finalizado_em;
        const semPlacar = destino === "resumo" && !p.placar_finalizado_em;
        return (
          <Link
            key={p.id}
            to={comPlacar ? "/pelada/$id/resumo" : "/pelada/$id"}
            params={{ id: p.id }}
            className={cn("flex items-center gap-3 px-3 py-2.5", semPlacar && "opacity-60")}
          >
            {comPlacar ? (
              <Trophy className="size-4 shrink-0 text-tier-ouro" />
            ) : (
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">
                {p.titulo}
              </span>
              <span className="block text-[11px] text-muted-foreground capitalize">
                {diaCurto(p.data)} · {p.horario.slice(0, 5)}
              </span>
            </span>
            <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
              {comPlacar ? "Ver placar" : semPlacar ? "Sem placar" : "Abrir"}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
