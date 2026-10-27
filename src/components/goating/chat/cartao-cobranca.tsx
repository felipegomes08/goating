import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";

type Pessoa = { member_id: string; nome: string; user_id: string | null; pago_em: string | null };

type Cobranca = {
  pelada: { id: string; titulo: string; data: string };
  pode_marcar: boolean;
  pessoas: Pessoa[];
};

/** A cobrança de uma pelada (quem jogou e quem pagou), atualizada na hora quando alguém marca. */
function useCobranca(matchId: string) {
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: ["cobranca-da-pelada", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cobranca_da_pelada", { p_match_id: matchId });
      if (error) throw error;
      return data as unknown as Cobranca | null;
    },
  });

  useEffect(() => {
    const canal = supabase
      .channel(`cobranca-${matchId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pagamentos_da_pelada",
          filter: `match_id=eq.${matchId}`,
        },
        () => void queryClient.invalidateQueries({ queryKey: ["cobranca-da-pelada", matchId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [matchId, queryClient]);

  return consulta;
}

/**
 * Cartão da cobrança no chat: valor por pessoa, chave Pix (com botão de copiar) e a lista de
 * quem jogou, com o ✓ de quem já pagou. Só o organizador ou ADM toca pra marcar.
 */
export function CartaoCobranca({
  matchId,
  valor,
  pix,
  userId,
}: {
  matchId: string;
  /** em centavos */
  valor: number;
  pix: string | null;
  userId: string | null;
}) {
  const queryClient = useQueryClient();
  const cobranca = useCobranca(matchId);
  const [marcando, setMarcando] = useState<string | null>(null);

  if (cobranca.isLoading) {
    return <div className="h-40 w-full animate-pulse rounded-2xl bg-card" />;
  }
  if (!cobranca.data) {
    return (
      <div className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-sm">
        Essa pelada não existe mais.
      </div>
    );
  }

  const { pelada, pode_marcar: podeMarcar, pessoas } = cobranca.data;
  const pagos = pessoas.filter((p) => p.pago_em).length;
  const eu = pessoas.find((p) => p.user_id === userId);

  async function alternar(p: Pessoa) {
    setMarcando(p.member_id);
    const { error } = await supabase.rpc("marcar_pago", {
      p_match_id: matchId,
      p_member_id: p.member_id,
      p_pago: !p.pago_em,
    });
    setMarcando(null);
    if (error) {
      toast.error("Não deu pra marcar o pagamento.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["cobranca-da-pelada", matchId] });
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-tier-ouro/30 bg-card shadow-sm">
      <div className="bg-gradient-to-br from-tier-ouro/25 to-tier-ouro/5 px-4 py-3">
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-amber-700 uppercase">
          <Wallet className="size-3.5" /> Cobrança da pelada
        </p>
        <Link
          to="/pelada/$id"
          params={{ id: pelada.id }}
          className="mt-0.5 block truncate text-base leading-tight font-extrabold text-foreground underline-offset-2 hover:underline"
        >
          {pelada.titulo}
        </Link>
        <p className="mt-1 text-2xl font-black text-foreground">
          {formatarReais(valor)}{" "}
          <span className="text-sm font-semibold text-muted-foreground">por pessoa</span>
        </p>
        {pix && (
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(pix)
                .then(() => toast.success("Chave Pix copiada."))
            }
            className="mt-2 flex w-full items-center gap-2 rounded-xl bg-card/80 px-3 py-2 text-left"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold text-muted-foreground uppercase">
                Pix
              </span>
              <span className="block truncate text-sm font-semibold text-foreground">{pix}</span>
            </span>
            <Copy className="size-4 shrink-0 text-primary" />
          </button>
        )}
      </div>

      <div className="space-y-2 p-3">
        <div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-extrabold text-foreground">
              {pagos}/{pessoas.length} pagaram
            </span>
            <span className="text-muted-foreground">
              {formatarReais(pagos * valor)} de {formatarReais(pessoas.length * valor)}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-mint transition-all"
              style={{ width: `${(pagos / Math.max(1, pessoas.length)) * 100}%` }}
            />
          </div>
        </div>

        {eu && (
          <p
            className={cn(
              "rounded-xl px-3 py-2 text-center text-xs font-bold",
              eu.pago_em ? "bg-mint-soft text-primary" : "bg-tier-ouro/15 text-amber-800",
            )}
          >
            {eu.pago_em
              ? "Seu pagamento está confirmado ✓"
              : "Falta o seu. Depois de pagar, avisa o organizador."}
          </p>
        )}

        {podeMarcar && (
          <p className="text-[11px] text-muted-foreground">Toque no nome pra marcar quem pagou.</p>
        )}
        <ul className="divide-y divide-border rounded-xl border border-border">
          {pessoas.map((p) => {
            const conteudo = (
              <>
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full",
                    p.pago_em ? "bg-mint text-mint-foreground" : "border border-border",
                  )}
                >
                  {p.pago_em && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    p.user_id === userId ? "font-bold text-primary" : "text-foreground",
                    !p.pago_em && "text-muted-foreground",
                  )}
                >
                  {p.nome}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {marcando === p.member_id ? "..." : p.pago_em ? "pago" : "falta"}
                </span>
              </>
            );
            return (
              <li key={p.member_id}>
                {podeMarcar ? (
                  <button
                    type="button"
                    disabled={!!marcando}
                    onClick={() => void alternar(p)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left active:bg-secondary/60"
                  >
                    {conteudo}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2">{conteudo}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
