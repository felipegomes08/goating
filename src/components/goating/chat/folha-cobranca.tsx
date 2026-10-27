import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { centavosDoTexto, formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";

const chavePix = (crewId: string) => `goating-pix-${crewId}`;

function lerPix(crewId: string) {
  try {
    return localStorage.getItem(chavePix(crewId)) ?? "";
  } catch {
    return "";
  }
}

/**
 * Folha do organizador ou ADM pra cobrar uma pelada no chat da turma: escolhe a pelada (se não
 * veio escolhida), digita o valor por pessoa e, se quiser, a chave Pix (lembrada pra próxima).
 */
export function FolhaCobranca({
  crewId,
  matchId,
  onFechar,
  onEnviada,
}: {
  crewId: string;
  /** pelada já escolhida (vindo da tela da pelada); sem ela, mostra as últimas finalizadas */
  matchId?: string | undefined;
  onFechar: () => void;
  onEnviada?: () => void;
}) {
  const [escolhida, setEscolhida] = useState<string | null>(matchId ?? null);
  const [valor, setValor] = useState(0);
  const [pix, setPix] = useState(() => lerPix(crewId));
  const [enviando, setEnviando] = useState(false);

  const peladas = useQuery({
    queryKey: ["finalizadas-da-turma", crewId],
    enabled: !matchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, titulo, data")
        .eq("crew_id", crewId)
        .eq("status", "finalizada")
        .order("data", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  async function enviar() {
    if (!escolhida || valor < 100) return;
    setEnviando(true);
    const { error } = await supabase.rpc("enviar_cobranca", {
      p_match_id: escolhida,
      p_valor: valor,
      p_pix: pix.trim() || null,
    });
    setEnviando(false);
    if (error) {
      toast.error(
        /R\$|termina|Ninguém|Pix|organizador|rolando/.test(error.message)
          ? error.message
          : "Não deu pra mandar a cobrança.",
      );
      return;
    }
    try {
      localStorage.setItem(chavePix(crewId), pix.trim());
    } catch {
      // sem armazenamento: a chave só não fica lembrada
    }
    toast.success("Cobrança mandada no chat.");
    onEnviada?.();
    onFechar();
  }

  const dataCurta = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-label="Cobrar a pelada"
        className="max-h-[88dvh] w-full max-w-[480px] space-y-4 overflow-y-auto rounded-t-3xl bg-background p-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-foreground">
            <Wallet className="size-5 text-amber-600" /> Cobrar a pelada
          </h2>
          <button type="button" aria-label="Fechar" onClick={onFechar} className="p-1">
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        {!matchId && (
          <div className="space-y-1.5">
            <Label>Qual pelada?</Label>
            {peladas.isLoading ? (
              <Skeleton className="h-20 w-full rounded-2xl" />
            ) : (peladas.data ?? []).length === 0 ? (
              <p className="rounded-2xl bg-card p-3 text-sm text-muted-foreground">
                Nenhuma pelada terminada nessa turma ainda.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(peladas.data ?? []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setEscolhida(p.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-bold",
                      escolhida === p.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-foreground shadow-sm",
                    )}
                  >
                    {p.titulo} · {dataCurta(p.data)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="valor">Valor por pessoa</Label>
          <Input
            id="valor"
            inputMode="numeric"
            value={valor ? formatarReais(valor) : ""}
            placeholder="R$ 0,00"
            onChange={(e) => setValor(centavosDoTexto(e.target.value))}
            className="text-lg font-bold"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pix">
            Chave Pix <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="pix"
            value={pix}
            maxLength={140}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setPix(e.target.value)}
            placeholder="E-mail, celular, CPF ou chave aleatória"
          />
          <p className="text-xs text-muted-foreground">
            Aparece no cartão pra galera copiar. Fica salva pra próxima cobrança.
          </p>
        </div>

        <Button
          className="w-full"
          disabled={!escolhida || valor < 100 || enviando}
          onClick={() => void enviar()}
        >
          {enviando ? "Mandando..." : "Mandar cobrança no chat"}
        </Button>
      </div>
    </div>
  );
}
