import { Link } from "@tanstack/react-router";
import type { LinhaDaLiga } from "@/hooks/use-ligas";
import { CATEGORIAS, ORDEM_DAS_CATEGORIAS } from "@/lib/ligas";
import { cn } from "@/lib/utils";

/** Tabela da liga: posição, pontos e os números que contam. A linha de quem está vendo fica destacada. */
export function TabelaDaLiga({ linhas, userId }: { linhas: LinhaDaLiga[]; userId: string | null }) {
  if (linhas.length === 0) {
    return (
      <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
        Nenhuma pelada com placar na liga ainda. A tabela começa na primeira.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] text-muted-foreground uppercase">
            <th className="w-8 py-2 font-semibold">#</th>
            <th className="text-left font-semibold">Jogador</th>
            <th className="w-9 font-extrabold text-primary">P</th>
            <th className="w-7 font-semibold">J</th>
            <th className="w-7 font-semibold">V</th>
            <th className="w-7 font-semibold">E</th>
            <th className="w-7 font-semibold">G</th>
            <th className="w-9 pr-2 font-semibold">MVP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {linhas.map((l) => (
            <tr
              key={l.member_id}
              className={cn(
                "text-center tabular-nums",
                l.user_id === userId && "bg-mint-soft/70 font-bold",
                l.posicao === 1 && "bg-tier-ouro/10",
              )}
            >
              <td className="py-2 text-xs font-bold text-muted-foreground">
                {l.posicao === 1 ? "👑" : l.posicao}
              </td>
              <td className="max-w-0 truncate text-left font-semibold text-foreground">
                {l.user_id ? (
                  <Link to="/jogador/$id" params={{ id: l.user_id }}>
                    {l.nome}
                  </Link>
                ) : (
                  l.nome
                )}
              </td>
              <td className="font-black text-primary">{l.pontos}</td>
              <td>{l.peladas}</td>
              <td>{l.vitorias}</td>
              <td>{l.empates}</td>
              <td>{l.gols}</td>
              <td className="pr-2">{l.mvps}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
        P pontos · J peladas jogadas · V vitórias · E empates · G gols
      </p>
    </div>
  );
}

/** Quem lidera cada categoria agora (durante a liga). Empate: todos aparecem. */
export function LideresDaLiga({ linhas }: { linhas: LinhaDaLiga[] }) {
  const cards = ORDEM_DAS_CATEGORIAS.filter((c) => c !== "campeao").flatMap((c) => {
    const campo = CATEGORIAS[c].campo as keyof LinhaDaLiga;
    const maximo = Math.max(0, ...linhas.map((l) => Number(l[campo])));
    if (maximo === 0) return [];
    const nomes = linhas
      .filter((l) => Number(l[campo]) === maximo)
      .map((l) => l.nome.split(" ")[0]);
    return [{ categoria: c, nomes, valor: maximo }];
  });
  if (cards.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map(({ categoria, nomes, valor }) => {
        const { rotulo, icone: Icone, unidade } = CATEGORIAS[categoria];
        return (
          <div key={categoria} className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
            <p className="flex items-center gap-1 text-[10px] font-extrabold tracking-wide text-muted-foreground uppercase">
              <Icone className="size-3.5 text-primary" /> {rotulo}
            </p>
            <p className="mt-1 truncate text-sm font-extrabold text-foreground">
              {nomes.join(", ")}
            </p>
            <p className="text-[11px] text-muted-foreground">{unidade(valor)}</p>
          </div>
        );
      })}
    </div>
  );
}
