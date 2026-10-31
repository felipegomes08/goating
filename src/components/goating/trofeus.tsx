import { Link } from "@tanstack/react-router";
import { useTrofeus } from "@/hooks/use-ligas";
import { CATEGORIAS, type Categoria } from "@/lib/ligas";

/** Troféus de liga que a pessoa ganhou (campeão, artilheiro...). Some quando não tem nenhum. */
export function Trofeus({ userId }: { userId: string }) {
  const trofeus = useTrofeus(userId);
  if (!trofeus.data?.length) return null;
  return (
    <section className="space-y-2 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-bold text-foreground">Troféus · {trofeus.data.length}</h2>
      <div className="grid grid-cols-2 gap-2">
        {trofeus.data.map((t) => {
          const categoria = CATEGORIAS[t.categoria as Categoria];
          if (!categoria) return null;
          const Icone = categoria.icone;
          return (
            <Link
              key={`${t.liga_id}-${t.categoria}`}
              to="/liga/$id"
              params={{ id: t.liga_id }}
              className="flex items-center gap-2 rounded-xl bg-tier-ouro/10 p-2.5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tier-ouro/25">
                <Icone className="size-4 text-amber-700" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-extrabold text-foreground">
                  {categoria.rotulo}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {t.liga}
                  {t.turma ? ` · ${t.turma}` : ""}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
