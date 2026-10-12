import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, User, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAvatarUrl } from "@/hooks/use-avatar";
import { overallLiberado } from "@/lib/tiers";

/** Pedidos de entrada esperando resposta. Só dono e administradores recebem a lista. */
export function usePedidosDaTurma(crewId: string, souGestor: boolean) {
  return useQuery({
    queryKey: ["pedidos-turma", crewId],
    enabled: souGestor,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pedidos_da_turma", { p_crew_id: crewId });
      if (error) throw error;
      return data;
    },
  });
}

type Pedido = NonNullable<ReturnType<typeof usePedidosDaTurma>["data"]>[number];

/**
 * Quem pediu pra entrar na turma, com o resumo de cada um. O nome leva ao perfil,
 * onde estão a carta e os comentários de quem já jogou com a pessoa.
 */
export function PedidosDaTurma({
  crewId,
  onMudou,
}: {
  crewId: string;
  onMudou: () => Promise<void> | void;
}) {
  const queryClient = useQueryClient();
  const pedidos = usePedidosDaTurma(crewId, true);
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function responder(pedido: Pedido, aprovar: boolean) {
    setOcupado(pedido.id);
    const { error } = await supabase.rpc("responder_pedido_de_entrada", {
      p_pedido_id: pedido.id,
      p_aprovar: aprovar,
    });
    setOcupado(null);
    if (error) {
      toast.error(
        /[áéíóúãõç]/i.test(error.message) ? error.message : "Não deu pra responder o pedido.",
      );
      return;
    }
    toast.success(aprovar ? `${pedido.nome} entrou na turma.` : "Pedido recusado.");
    await queryClient.invalidateQueries({ queryKey: ["pedidos-turma", crewId] });
    if (aprovar) await onMudou();
  }

  const lista = pedidos.data ?? [];
  if (lista.length === 0) return null;

  return (
    <section className="rounded-2xl bg-mint-soft p-3">
      <h3 className="text-sm font-bold text-primary">
        {lista.length} {lista.length === 1 ? "pedido" : "pedidos"} pra entrar
      </h3>
      <ul className="mt-2 space-y-2">
        {lista.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-2xl bg-card p-2.5">
            <FotoDoPedido foto={p.foto_url} />
            <Link
              to="/jogador/$id"
              params={{ id: p.user_id }}
              className="min-w-0 flex-1 active:opacity-60"
            >
              <span className="block truncate text-sm font-extrabold text-foreground">
                {p.nome}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {[
                  p.posicao,
                  overallLiberado(p.avaliacoes_recebidas)
                    ? `overall ${Math.round(Number(p.overall))}`
                    : "sem nota ainda",
                  `${p.peladas} ${p.peladas === 1 ? "pelada" : "peladas"}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="block text-[11px] font-semibold text-primary underline">
                Ver perfil e comentários
              </span>
            </Link>
            <button
              type="button"
              aria-label={`Recusar ${p.nome}`}
              disabled={ocupado !== null}
              onClick={() => void responder(p, false)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground disabled:opacity-50"
            >
              <X className="size-4" />
            </button>
            <button
              type="button"
              aria-label={`Aceitar ${p.nome}`}
              disabled={ocupado !== null}
              onClick={() => void responder(p, true)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mint text-mint-foreground disabled:opacity-50"
            >
              <Check className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** O caminho da foto é de um bucket privado: sem URL assinada a imagem aparece quebrada. */
function FotoDoPedido({ foto }: { foto: string | null }) {
  const url = useAvatarUrl(foto);
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <User className="size-4 text-muted-foreground" />
      )}
    </span>
  );
}
