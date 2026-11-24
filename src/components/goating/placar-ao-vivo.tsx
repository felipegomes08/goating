import { useEffect, useState } from "react";
import type { PlacarAoVivo } from "@/hooks/use-placar-ao-vivo";
import { cn } from "@/lib/utils";
import {
  NOME_DO_LANCE,
  corDoTime,
  decorridoMs,
  formatarRelogio,
  jogoAtual,
  nomeDoTime,
  placarDoJogo,
  placarDosPenaltis,
  type Jogo,
  type TipoDeLance,
} from "@/lib/placar/estado";

/** Relógio que anda sozinho a cada segundo (não depende de chegar dado novo). */
function useAgora(ligado: boolean) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ligado) return;
    const tique = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(tique);
  }, [ligado]);
  return agora;
}

/** O jogo que a tela mostra: o que está rolando ou, entre um e outro, o último que acabou. */
const jogoEmFoco = (dados: PlacarAoVivo) =>
  dados.estado ? (jogoAtual(dados.estado) ?? dados.estado.jogos.at(-1) ?? null) : null;

/** "AO VIVO" pulsando, "Intervalo", "Encerrada"... */
export function SeloAoVivo({ dados, className }: { dados: PlacarAoVivo; className?: string }) {
  const atual = dados.estado ? jogoAtual(dados.estado) : null;
  if (dados.status === "finalizada") {
    return (
      <span
        className={cn(
          "rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-extrabold text-muted-foreground uppercase",
          className,
        )}
      >
        Encerrada
      </span>
    );
  }
  const rolando = !!atual?.iniciadoEm;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase",
        rolando ? "bg-red-600 text-white" : "bg-red-600/10 text-red-600",
        className,
      )}
    >
      <span className="relative flex size-2">
        {rolando && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex size-2 rounded-full",
            rolando ? "bg-white" : "bg-red-600",
          )}
        />
      </span>
      {rolando ? "Ao vivo" : atual ? "Ao vivo · pausado" : "Ao vivo · intervalo"}
    </span>
  );
}

/** Placar pequeno do card do feed: selo, "Time A 3 × 2 Time B" e o relógio. */
export function PlacarAoVivoMini({ dados }: { dados: PlacarAoVivo }) {
  const jogo = jogoEmFoco(dados);
  const agora = useAgora(!!jogo?.iniciadoEm);
  const cor = (t: number) => corDoTime(t, dados.cores_times);
  const nome = (t: number) => nomeDoTime(dados.nomes_times, t);
  if (!jogo) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl bg-red-600/5 px-3 py-2">
        <SeloAoVivo dados={dados} />
        <span className="text-xs font-semibold text-muted-foreground">Times em campo já já</span>
      </div>
    );
  }
  const [a, b] = placarDoJogo(jogo);
  const ms = decorridoMs(jogo, agora + dados.ajusteDoRelogio);
  return (
    <div className="space-y-1.5 rounded-xl bg-red-600/5 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <SeloAoVivo dados={dados} />
        {!jogo.encerrado && (
          <span className="text-xs font-bold text-foreground tabular-nums">
            {jogo.tempo}º T · {formatarRelogio(ms)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span
          className={cn("truncate text-right text-sm font-extrabold", cor(jogo.times[0]).texto)}
        >
          {nome(jogo.times[0])}
        </span>
        <span className="text-xl font-black text-foreground tabular-nums">
          {a} × {b}
        </span>
        <span className={cn("truncate text-sm font-extrabold", cor(jogo.times[1]).texto)}>
          {nome(jogo.times[1])}
        </span>
      </div>
    </div>
  );
}

const COR_DO_LANCE: Record<TipoDeLance, string> = {
  assistencia: "bg-emerald-500",
  defesa: "bg-sky-500",
  amarelo: "bg-yellow-400",
  azul: "bg-blue-600",
  vermelho: "bg-red-600",
};

type ItemDoLanceALance =
  | {
      tipo: "gol";
      id: string;
      lado: 0 | 1;
      memberId: string | null;
      tempo: number;
      minuto: number;
      assistencia: string | null;
    }
  | { tipo: TipoDeLance; id: string; lado: 0 | 1; memberId: string; tempo: number; minuto: number };

/** Gols (com a assistência junto) e os outros lances, do mais novo pro mais antigo. */
function lanceALance(jogo: Jogo): ItemDoLanceALance[] {
  const lances = jogo.lances ?? [];
  const gols: ItemDoLanceALance[] = jogo.gols.map((g) => ({
    tipo: "gol",
    id: g.id,
    lado: g.lado,
    memberId: g.memberId,
    tempo: g.tempo,
    minuto: g.minuto,
    assistencia: lances.find((l) => l.tipo === "assistencia" && l.golId === g.id)?.memberId ?? null,
  }));
  // assistência ligada a um gol aparece no gol; as soltas aparecem sozinhas
  const outros: ItemDoLanceALance[] = lances
    .filter(
      (l) => !(l.tipo === "assistencia" && l.golId && jogo.gols.some((g) => g.id === l.golId)),
    )
    .map((l) => ({ ...l }));
  return [...gols, ...outros].sort((x, y) => y.tempo - x.tempo || y.minuto - x.minuto);
}

/** A tela inteira do ao vivo: placar grande, relógio, lance a lance, escalações e jogos do dia. */
export function TelaAoVivo({ dados }: { dados: PlacarAoVivo }) {
  const jogo = jogoEmFoco(dados);
  const agora = useAgora(true);
  const cor = (t: number) => corDoTime(t, dados.cores_times);
  const nome = (t: number) => nomeDoTime(dados.nomes_times, t);
  const nomeJogador = (memberId: string | null) =>
    memberId ? (dados.jogadores[memberId]?.nome ?? "Jogador") : "Sem autor / contra";
  const encerrados = (dados.estado?.jogos ?? []).filter((j) => j.encerrado && j.id !== jogo?.id);
  const numeroDoJogo = jogo ? (dados.estado?.jogos.indexOf(jogo) ?? 0) + 1 : 0;
  const atualizadoHa = dados.atualizado_em
    ? Math.max(
        0,
        Math.floor(
          (agora + dados.ajusteDoRelogio - new Date(dados.atualizado_em).getTime()) / 1000,
        ),
      )
    : null;
  const aoVivo = dados.status === "em_andamento";

  if (!jogo) {
    return (
      <div className="space-y-3 rounded-2xl bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <SeloAoVivo dados={dados} />
        <p className="text-sm text-muted-foreground">
          {aoVivo
            ? "A pelada começou. O placar aparece aqui assim que o primeiro jogo sair."
            : "Essa pelada ainda não tem placar."}
        </p>
      </div>
    );
  }

  const [a, b] = placarDoJogo(jogo);
  const penaltis = placarDosPenaltis(jogo);
  const limiteMs = (dados.minutos_tempo ?? 30) * 60_000;
  const ms = decorridoMs(jogo, agora + dados.ajusteDoRelogio);
  const lista = lanceALance(jogo);

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-2">
          <SeloAoVivo dados={dados} />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">
            Jogo {numeroDoJogo}
            {!jogo.encerrado && ` · ${jogo.tempo}º tempo`}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
          {([0, 1] as const).map((lado) => (
            <div key={lado} className={cn(cor(jogo.times[lado]).texto, lado === 1 && "order-3")}>
              <p className="truncate text-sm font-extrabold uppercase">{nome(jogo.times[lado])}</p>
              <p className="text-7xl leading-none font-black tabular-nums">{lado === 0 ? a : b}</p>
            </div>
          ))}
          <span className="order-2 text-3xl font-bold text-muted-foreground">×</span>
        </div>
        {penaltis && (
          <p className="text-center text-sm font-bold text-foreground">
            Pênaltis: {penaltis[0]} × {penaltis[1]}
          </p>
        )}
        {!jogo.encerrado ? (
          <div className="flex flex-col items-center rounded-2xl bg-secondary/60 py-2">
            <span className="text-4xl leading-none font-extrabold tabular-nums">
              {formatarRelogio(Math.min(ms, limiteMs))}
            </span>
            {ms > limiteMs && (
              <span className="text-sm font-bold text-destructive tabular-nums">
                +{formatarRelogio(ms - limiteMs)}
              </span>
            )}
            <span className="mt-1 text-[11px] font-semibold text-muted-foreground uppercase">
              {jogo.iniciadoEm ? "Rolando" : ms > 0 ? "Pausado" : "Vai começar"}
            </span>
          </div>
        ) : (
          <p className="text-center text-xs font-semibold text-muted-foreground uppercase">
            {aoVivo ? "Fim de jogo · esperando o próximo" : "Fim de jogo"}
          </p>
        )}
        {aoVivo && (
          <p className="text-center text-[11px] text-muted-foreground">
            {dados.marcador ? `${dados.marcador} está marcando` : "Placar ao vivo"}
            {atualizadoHa !== null && atualizadoHa > 15
              ? ` · atualizado há ${atualizadoHa < 60 ? `${atualizadoHa}s` : `${Math.floor(atualizadoHa / 60)} min`}`
              : ""}
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
        <h2 className="mb-1 text-sm font-bold text-foreground">Lance a lance</h2>
        {lista.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nenhum lance ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {lista.map((item) => (
              <li key={item.id} className="flex items-center gap-2.5 py-2 text-sm">
                <span className="w-12 shrink-0 text-[11px] font-bold text-muted-foreground tabular-nums">
                  {item.minuto}' {item.tempo}ºT
                </span>
                {item.tipo === "gol" ? (
                  <span aria-hidden className="text-base leading-none">
                    ⚽
                  </span>
                ) : (
                  <span className={cn("size-3.5 shrink-0 rounded", COR_DO_LANCE[item.tipo])} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-foreground">
                    {item.tipo === "gol"
                      ? `Gol: ${nomeJogador(item.memberId)}`
                      : `${NOME_DO_LANCE[item.tipo]}: ${nomeJogador(item.memberId)}`}
                  </span>
                  {item.tipo === "gol" && item.assistencia && (
                    <span className="block truncate text-xs text-muted-foreground">
                      Assistência: {nomeJogador(item.assistencia)}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    cor(jogo.times[item.lado]).solido,
                  )}
                  aria-label={nome(jogo.times[item.lado])}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
        <h2 className="mb-2 text-sm font-bold text-foreground">Escalações</h2>
        <div className="grid grid-cols-2 gap-3">
          {([0, 1] as const).map((lado) => (
            <div key={lado} className="min-w-0">
              <p
                className={cn(
                  "mb-1 truncate border-b-4 pb-1 text-xs font-extrabold uppercase",
                  cor(jogo.times[lado]).texto,
                  cor(jogo.times[lado]).borda,
                )}
              >
                {nome(jogo.times[lado])}
              </p>
              <ul className="space-y-1">
                {jogo.lados[lado].map((memberId) => (
                  <li
                    key={memberId}
                    className="flex items-center gap-1 truncate text-sm text-foreground"
                  >
                    {jogo.goleiros?.[lado] === memberId && (
                      <span aria-label="goleiro" className="text-xs">
                        🧤
                      </span>
                    )}
                    <span className="truncate">{nomeJogador(memberId)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {encerrados.length > 0 && (
        <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-1 text-sm font-bold text-foreground">Jogos de hoje</h2>
          <ul className="divide-y divide-border">
            {encerrados.map((j) => {
              const [ga, gb] = placarDoJogo(j);
              return (
                <li key={j.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="w-5 text-xs font-bold text-muted-foreground">
                    {(dados.estado?.jogos.indexOf(j) ?? 0) + 1}
                  </span>
                  <span
                    className={cn(
                      "flex-1 truncate text-right font-semibold",
                      cor(j.times[0]).texto,
                    )}
                  >
                    {nome(j.times[0])}
                  </span>
                  <span className="font-extrabold tabular-nums">
                    {ga} × {gb}
                  </span>
                  <span className={cn("flex-1 truncate font-semibold", cor(j.times[1]).texto)}>
                    {nome(j.times[1])}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
