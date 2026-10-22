import { CalendarCheck, Crown, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIERS, type TierConfig } from "@/lib/tiers";
import { cn } from "@/lib/utils";

/** Como se ganha XP (a mesma regra da função `calcular_xp` do banco). */
const GANHOS = [
  {
    icone: CalendarCheck,
    titulo: "Jogar uma pelada",
    valor: "+10 XP",
    texto: "Cada pelada finalizada que você jogou (uma por dia).",
  },
  {
    icone: Star,
    titulo: "Receber uma avaliação",
    valor: "+2 + a nota",
    texto: "Cada avaliação vale 2 XP mais a nota que você recebeu: nota 8 dá +10 XP.",
  },
  {
    icone: Crown,
    titulo: "Ser MVP",
    valor: "+5 XP",
    texto: "Cada vez que você é eleito o melhor da pelada.",
  },
];

/**
 * Folha "Como funciona o XP": de onde vem o XP e o que cada nível pede (XP e overall).
 */
export function FolhaXp({
  xp,
  overall,
  tier,
  onFechar,
}: {
  xp: number;
  overall: number;
  tier: TierConfig | null;
  onFechar: () => void;
}) {
  const ordemAtual = tier?.ordem ?? 0;
  const proximo = TIERS.find((t) => t.ordem === ordemAtual + 1) ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-label="Como funciona o XP"
        className="max-h-[88dvh] w-full max-w-[480px] space-y-4 overflow-y-auto rounded-t-3xl bg-card p-4 pb-6"
      >
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-foreground">
            <Zap className="size-5 fill-tier-ouro text-tier-ouro" /> Como funciona o XP
          </h2>
          <p className="text-sm text-muted-foreground">
            Você tem <b className="text-foreground">{xp} XP</b>. Ele sobe sozinho conforme você
            joga.
          </p>
        </div>

        <ul className="space-y-2">
          {GANHOS.map((g) => (
            <li key={g.titulo} className="flex items-start gap-3 rounded-2xl bg-secondary/60 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <g.icone className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-foreground">{g.titulo}</span>
                  <span className="shrink-0 text-sm font-black text-primary">{g.valor}</span>
                </span>
                <span className="block text-xs text-muted-foreground">{g.texto}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="space-y-2">
          <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Níveis: XP e overall
          </h3>
          <p className="text-xs text-muted-foreground">
            Pra subir de nível precisa das duas coisas: XP (jogar bastante) e overall (jogar bem).
          </p>
          <ul className="overflow-hidden rounded-2xl border border-border">
            {TIERS.map((t) => {
              const atual = t.ordem === ordemAtual;
              const eProximo = t.ordem === proximo?.ordem;
              return (
                <li
                  key={t.nome}
                  className={cn(
                    "flex items-center gap-3 border-b border-border px-3 py-2 last:border-0",
                    atual && "bg-mint-soft",
                  )}
                >
                  <img src={t.icone} alt="" className="size-7 object-contain" />
                  <span className="flex-1 text-sm font-bold text-foreground">
                    {t.nome}
                    {atual && <span className="ml-1 text-[10px] text-primary">· você</span>}
                    {eProximo && <span className="ml-1 text-[10px] text-tier-ouro">· próximo</span>}
                  </span>
                  <span className="text-right text-xs text-muted-foreground tabular-nums">
                    {t.xpMinimo > 0 ? `${t.xpMinimo} XP` : "3 avaliações"}
                    {t.overallMinimo > 0 && ` · overall ${t.overallMinimo}`}
                  </span>
                </li>
              );
            })}
          </ul>
          {proximo && (
            <p className="text-xs font-semibold text-foreground">
              Pro {proximo.nome}:{" "}
              {[
                xp < proximo.xpMinimo ? `faltam ${proximo.xpMinimo - xp} XP` : "XP já tem",
                overall < proximo.overallMinimo
                  ? `overall ${proximo.overallMinimo} (hoje ${Math.round(overall)})`
                  : "overall já tem",
              ].join(" · ")}
            </p>
          )}
        </div>

        <Button className="w-full" onClick={onFechar}>
          Entendi
        </Button>
      </div>
    </div>
  );
}
