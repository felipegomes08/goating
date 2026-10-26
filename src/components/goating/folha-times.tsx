import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CORES_TIME, corDoTime, nomeDoTime } from "@/lib/placar/estado";

/**
 * Folha pra dar nome e cor de colete a cada time ("Roxo" e "Vermelho", "Casados" e
 * "Solteiros"...). Vale pro quadro dos times, pro placar e pro resumo da pelada.
 */
export function FolhaTimes({
  numTimes,
  nomes,
  cores,
  onSalvar,
  onFechar,
}: {
  numTimes: number;
  nomes: string[];
  cores: (string | null)[];
  /** devolve true quando salvou; a folha fecha sozinha */
  onSalvar: (nomes: string[], cores: string[]) => Promise<boolean>;
  onFechar: () => void;
}) {
  const indices = Array.from({ length: numTimes }, (_, i) => i);
  const [rascunho, setRascunho] = useState(() =>
    indices.map((i) => ({ nome: nomeDoTime(nomes, i), cor: corDoTime(i, cores).id as string })),
  );
  const [salvando, setSalvando] = useState(false);

  const limpos = rascunho.map((t, i) => t.nome.replace(/\s+/g, " ").trim() || `Time ${i + 1}`);
  const repetido = limpos.find(
    (n, i) => limpos.findIndex((m) => m.toLowerCase() === n.toLowerCase()) !== i,
  );

  function mudar(i: number, campo: { nome?: string; cor?: string }) {
    setRascunho((r) => r.map((t, j) => (j === i ? { ...t, ...campo } : t)));
  }

  async function salvar() {
    if (repetido || salvando) return;
    setSalvando(true);
    const ok = await onSalvar(
      limpos,
      rascunho.map((t) => t.cor),
    );
    setSalvando(false);
    if (ok) onFechar();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-label="Nome e cor dos times"
        className="max-h-[90dvh] w-full max-w-[480px] space-y-4 overflow-y-auto rounded-t-3xl bg-card p-4 pb-6"
      >
        <div>
          <h2 className="text-lg font-extrabold text-foreground">Nome e cor dos times</h2>
          <p className="text-xs text-muted-foreground">
            Use a cor dos coletes do dia. Aparece nos times, no placar e no resumo.
          </p>
        </div>

        {rascunho.map((t, i) => {
          const cor = CORES_TIME.find((c) => c.id === t.cor) ?? corDoTime(i);
          return (
            <section
              key={i}
              className={cn("space-y-2 rounded-2xl border-l-4 p-3", cor.borda, cor.fundo)}
            >
              <Input
                value={t.nome}
                maxLength={20}
                placeholder={`Time ${i + 1}`}
                onChange={(e) => mudar(i, { nome: e.target.value })}
                aria-label={`Nome do time ${i + 1}`}
                className="bg-card font-bold"
              />
              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-label={`Cor do time ${i + 1}`}
              >
                {CORES_TIME.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={t.cor === c.id}
                    aria-label={c.rotulo}
                    title={c.rotulo}
                    onClick={() => mudar(i, { cor: c.id })}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full ring-1 ring-black/15 ring-inset",
                      t.cor === c.id && "outline-2 outline-offset-2 outline-foreground",
                    )}
                    style={{ background: c.hexa }}
                  >
                    {t.cor === c.id && <Check className={cn("size-4", c.sobre)} strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        {repetido && (
          <p className="text-xs font-medium text-destructive">
            Dois times com o nome “{repetido}”. Dê um nome diferente pra cada um.
          </p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onFechar}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={!!repetido || salvando} onClick={salvar}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
