import { cn } from "@/lib/utils";
import { corDoTime, type LinhaTime } from "@/lib/placar/estado";

export function TabelaTimes({
  tabela,
  nomeTime,
}: {
  tabela: LinhaTime[];
  nomeTime: (time: number) => string;
}) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
      <h2 className="mb-2 text-sm font-bold text-foreground">Times no dia</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] text-muted-foreground uppercase">
            <th className="text-left font-semibold">Time</th>
            <th className="w-8 font-semibold">J</th>
            <th className="w-8 font-semibold">V</th>
            <th className="w-8 font-semibold">E</th>
            <th className="w-8 font-semibold">D</th>
            <th className="w-12 font-semibold">Gols</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tabela.map((l) => (
            <tr key={l.time} className="text-center tabular-nums">
              <td className={cn("py-2 text-left font-bold", corDoTime(l.time).texto)}>
                {nomeTime(l.time)}
              </td>
              <td>{l.jogos}</td>
              <td className="font-extrabold">{l.vitorias}</td>
              <td>{l.empates}</td>
              <td>{l.derrotas}</td>
              <td>
                {l.golsPro}:{l.golsContra}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
