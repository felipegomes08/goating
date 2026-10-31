import { CalendarRange, Trophy } from "lucide-react";
import type { Liga } from "@/hooks/use-ligas";
import { diasQueFaltam, periodoDaLiga, progressoDaLiga, situacaoDaLiga } from "@/lib/ligas";

/** Cartão de cima da liga: nome, descrição, período, quanto falta e a rodada. */
export function CabecalhoDaLiga({ liga, rodadas }: { liga: Liga; rodadas: number }) {
  const situacao = situacaoDaLiga(liga);
  const faltam = diasQueFaltam(liga);
  return (
    <section className="rounded-3xl bg-primary p-4 text-primary-foreground shadow-[var(--shadow-card)]">
      <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-mint uppercase">
        <Trophy className="size-3.5" />
        {situacao === "encerrada"
          ? "Liga encerrada"
          : situacao === "futura"
            ? "Liga marcada"
            : "Liga rolando"}
      </p>
      <h2 className="mt-1 text-2xl leading-tight font-extrabold">{liga.nome}</h2>
      {liga.descricao && (
        <p className="mt-1 text-sm whitespace-pre-line text-primary-foreground/80">
          {liga.descricao}
        </p>
      )}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-mint">
        <CalendarRange className="size-3.5" /> {periodoDaLiga(liga)}
        {situacao === "rolando" &&
          ` · ${faltam === 0 ? "último dia" : `faltam ${faltam} ${faltam === 1 ? "dia" : "dias"}`}`}
        {situacao !== "futura" && ` · ${rodadas} ${rodadas === 1 ? "rodada" : "rodadas"}`}
      </p>
      {situacao === "rolando" && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-mint"
            style={{ width: `${progressoDaLiga(liga) * 100}%` }}
          />
        </div>
      )}
      <p className="mt-2 text-[11px] text-primary-foreground/60">
        Pontos: vitória {liga.pts_vitoria} · empate {liga.pts_empate} · presença {liga.pts_presenca}
        {liga.pts_gol > 0 && ` · gol ${liga.pts_gol}`}
        {liga.pts_mvp > 0 && ` · MVP ${liga.pts_mvp}`}
      </p>
    </section>
  );
}
