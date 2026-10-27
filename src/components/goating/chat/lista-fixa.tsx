import { useState } from "react";
import { ChevronUp, ClipboardList } from "lucide-react";
import { useListaDaPelada } from "@/hooks/use-lista-da-pelada";
import { BotoesDaResposta, MinhaResposta } from "@/components/goating/chat/cartao-lista";
import { quandoDaPelada } from "@/lib/quando-da-pelada";

/**
 * A lista que está rolando, fixa embaixo do chat (em cima do campo de mensagem): a conversa
 * passa por cima e ela continua à vista, com a resposta de quem está vendo ou os botões pra
 * responder. Tocar no título abre a lista inteira.
 */
export function ListaFixa({
  matchId,
  userId,
  onAbrir,
}: {
  matchId: string;
  userId: string | null;
  onAbrir: () => void;
}) {
  const lista = useListaDaPelada(matchId, userId);
  const [mudando, setMudando] = useState(false);
  if (!lista.data || lista.data.pelada.comecou) return null;

  const { pelada } = lista.data;
  const lotou = pelada.confirmados >= pelada.vagas;
  const respondida = lista.minha === "vou" || lista.minha === "nao_vou";

  return (
    <div className="space-y-1.5 border-t border-border bg-card px-3 pt-2 pb-1.5 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
      <button type="button" onClick={onAbrir} className="flex w-full items-center gap-2 text-left">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary">
          <ClipboardList className="size-3.5 text-mint" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-extrabold text-foreground">
            Lista: {pelada.titulo}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {quandoDaPelada(pelada.data, pelada.horario)} · {pelada.confirmados}/{pelada.vagas}{" "}
            confirmados
          </span>
        </span>
        <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {respondida && !mudando ? (
        <MinhaResposta resposta={lista.minha} compacta onMudar={() => setMudando(true)} />
      ) : (
        <BotoesDaResposta
          compacta
          minha={lista.minha}
          lotou={lotou}
          respondendo={lista.respondendo}
          onResponder={(vou) =>
            void lista.responder(vou).then((ok) => {
              if (ok) setMudando(false);
            })
          }
          onCancelar={mudando ? () => setMudando(false) : undefined}
        />
      )}
    </div>
  );
}
