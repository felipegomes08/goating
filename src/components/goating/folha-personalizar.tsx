import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, Check, Crown, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FolhaPremium } from "@/components/goating/cadeado";
import { CAPAS, type CapaId } from "@/lib/capas";
import { MOLDURAS, type MolduraId } from "@/lib/molduras";
import { cn } from "@/lib/utils";

export type Previa = { moldura: MolduraId | null; capa: CapaId | null };

/**
 * Personalizar a carta: moldura e capa do perfil. Quem é Premium salva na hora; quem não é
 * experimenta (a carta e a capa mudam enquanto a folha está aberta) e vê o convite do Premium.
 */
export function FolhaPersonalizar({
  userId,
  premium,
  atual,
  previa,
  onPrevia,
  onFechar,
}: {
  userId: string;
  premium: boolean;
  /** o que está salvo hoje */
  atual: Previa;
  /** o que está aparecendo agora (salvo ou experimentando) */
  previa: Previa;
  onPrevia: (p: Previa) => void;
  onFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const [convite, setConvite] = useState(false);

  async function escolher(mudanca: Partial<Previa>) {
    const nova = { ...previa, ...mudanca };
    onPrevia(nova);
    if (!premium) return;
    const { error } = await supabase.from("profiles").update(mudanca).eq("id", userId);
    if (error) {
      toast.error("Não deu pra salvar agora.");
      onPrevia(atual);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["perfil", userId] });
  }

  const opcao = (ativo: boolean) =>
    cn(
      "flex flex-col items-center gap-1 rounded-2xl p-1.5 text-[11px] font-semibold",
      ativo ? "bg-tier-ouro/20 text-foreground" : "text-muted-foreground",
    );
  const marca = (ativo: boolean) =>
    ativo ? <Check className="absolute right-0.5 bottom-0.5 size-3.5 text-white" /> : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-label="Personalizar carta"
        className="w-full max-w-[480px] space-y-4 rounded-t-3xl bg-card p-4 pb-6"
      >
        <div className="flex items-center gap-2">
          <Crown className="size-5 fill-tier-ouro text-tier-ouro" />
          <h2 className="flex-1 text-lg font-extrabold text-foreground">Personalizar carta</h2>
          {!premium && <Lock className="size-4 text-tier-ouro" />}
        </div>

        {!premium && (
          <p className="rounded-xl bg-tier-ouro/15 px-3 py-2 text-xs text-foreground">
            Toque pra experimentar. Molduras e capas são do Premium.
          </p>
        )}

        <section className="space-y-2">
          <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Moldura
          </h3>
          <div className="grid grid-cols-6 gap-1">
            <button
              type="button"
              className={opcao(!previa.moldura)}
              onClick={() => void escolher({ moldura: null })}
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-secondary">
                <Ban className="size-4 text-muted-foreground" />
              </span>
              Nenhuma
            </button>
            {MOLDURAS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={opcao(previa.moldura === m.id)}
                onClick={() => void escolher({ moldura: m.id })}
              >
                <span
                  className="relative size-10 rounded-full"
                  style={{
                    // as de arte mostram um pedaço da própria arte (a borda de cima da carta)
                    background: m.arte
                      ? `#0b1510 url(${m.arte}) 50% 8% / 230% no-repeat`
                      : `conic-gradient(${m.cores.join(", ")})`,
                    boxShadow: `0 0 10px ${m.brilho}`,
                  }}
                >
                  {marca(previa.moldura === m.id)}
                </span>
                {m.nome}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Capa do perfil
          </h3>
          <div className="grid grid-cols-6 gap-1">
            <button
              type="button"
              className={opcao(!previa.capa)}
              onClick={() => void escolher({ capa: null })}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary">
                <Ban className="size-4 text-mint/60" />
              </span>
              Padrão
            </button>
            {CAPAS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={opcao(previa.capa === c.id)}
                onClick={() => void escolher({ capa: c.id })}
              >
                <span className="relative size-10 rounded-xl" style={{ background: c.fundo }}>
                  {marca(previa.capa === c.id)}
                </span>
                {c.nome}
              </button>
            ))}
          </div>
        </section>

        {premium ? (
          <Button className="w-full" onClick={onFechar}>
            Pronto
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                onPrevia(atual);
                onFechar();
              }}
            >
              Fechar
            </Button>
            <Button className="flex-1" onClick={() => setConvite(true)}>
              Quero essa
            </Button>
          </div>
        )}
      </div>
      {convite && (
        <FolhaPremium recurso="Personalizar a carta" onFechar={() => setConvite(false)} />
      )}
    </div>
  );
}
