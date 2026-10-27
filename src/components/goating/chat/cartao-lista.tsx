import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, ChevronDown, ClipboardList, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { quandoDaPelada } from "@/lib/quando-da-pelada";

type Resposta = "vou" | "pendente" | "nao_vou" | null;

type Pessoa = { user_id: string; nome: string; foto_url: string | null; resposta: Resposta };

type Lista = {
  pelada: {
    id: string;
    titulo: string;
    data: string;
    horario: string;
    local: string;
    vagas: number;
    confirmados: number;
    comecou: boolean;
  };
  pessoas: Pessoa[];
};

/** A lista da pelada (o cartão do chat), atualizada na hora quando alguém responde. */
function useListaDaPelada(matchId: string) {
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: ["lista-da-pelada", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("lista_da_pelada", { p_match_id: matchId });
      if (error) throw error;
      return data as unknown as Lista | null;
    },
  });

  useEffect(() => {
    const atualizar = () =>
      void queryClient.invalidateQueries({ queryKey: ["lista-da-pelada", matchId] });
    const filtro = `match_id=eq.${matchId}`;
    const canal = supabase
      .channel(`lista-${matchId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_participants", filter: filtro },
        atualizar,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nao_vou", filter: filtro },
        atualizar,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [matchId, queryClient]);

  return consulta;
}

/**
 * Cartão da lista de confirmação no chat: a pelada, quem vai, quem não vai e quem ainda não
 * respondeu, com os botões "Vou" e "Não vou". O "Vou" já coloca a pessoa na pelada.
 */
export function CartaoLista({ matchId, userId }: { matchId: string; userId: string | null }) {
  const queryClient = useQueryClient();
  const lista = useListaDaPelada(matchId);
  const [respondendo, setRespondendo] = useState<boolean | null>(null);
  const [abertos, setAbertos] = useState(false);

  if (lista.isLoading) {
    return <div className="h-40 w-full animate-pulse rounded-2xl bg-card" />;
  }
  if (!lista.data) {
    return (
      <div className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-sm">
        Essa pelada não existe mais.
      </div>
    );
  }

  const { pelada, pessoas } = lista.data;
  const minha = pessoas.find((p) => p.user_id === userId)?.resposta ?? null;
  const vao = pessoas.filter((p) => p.resposta === "vou");
  const pendentes = pessoas.filter((p) => p.resposta === "pendente");
  const naoVao = pessoas.filter((p) => p.resposta === "nao_vou");
  const semResposta = pessoas.filter((p) => p.resposta === null);
  const lotou = pelada.confirmados >= pelada.vagas;

  async function responder(vou: boolean) {
    setRespondendo(vou);
    const { data, error } = await supabase.rpc("responder_lista", {
      p_match_id: matchId,
      p_vou: vou,
    });
    setRespondendo(null);
    if (error) {
      toast.error(
        /Lotou|começou|turma/.test(error.message) ? error.message : "Não deu pra responder.",
      );
      return;
    }
    toast.success(
      data === "nao_vou" ? "Beleza, fica pra próxima." : "Tá dentro! Seu nome entrou na lista.",
    );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lista-da-pelada", matchId] }),
      queryClient.invalidateQueries({ queryKey: ["pelada", matchId] }),
      queryClient.invalidateQueries({ queryKey: ["feed"] }),
    ]);
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-sm">
      <div className="bg-primary px-4 py-3">
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-mint uppercase">
          <ClipboardList className="size-3.5" /> Lista da pelada
        </p>
        <Link
          to="/pelada/$id"
          params={{ id: pelada.id }}
          className="mt-0.5 block truncate text-lg leading-tight font-extrabold text-primary-foreground underline-offset-2 hover:underline"
        >
          {pelada.titulo}
        </Link>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-primary-foreground/80">
          <CalendarDays className="size-3.5 shrink-0" />{" "}
          {quandoDaPelada(pelada.data, pelada.horario)}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-primary-foreground/80">
          <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{pelada.local}</span>
        </p>
      </div>

      <div className="space-y-3 p-3">
        <div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-extrabold text-foreground">
              {pelada.confirmados}/{pelada.vagas} confirmados
            </span>
            {lotou && <span className="font-bold text-destructive">Lotou</span>}
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-mint transition-all"
              style={{
                width: `${Math.min(100, (pelada.confirmados / Math.max(1, pelada.vagas)) * 100)}%`,
              }}
            />
          </div>
        </div>

        {pelada.comecou ? (
          <p className="rounded-xl bg-secondary/60 px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
            A pelada já começou: a lista fechou.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={respondendo !== null || minha === "vou" || lotou}
              onClick={() => void responder(true)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-extrabold transition-colors",
                minha === "vou"
                  ? "bg-mint text-mint-foreground"
                  : "border border-primary/30 text-primary disabled:opacity-40",
              )}
            >
              <Check className="size-4" strokeWidth={3} />
              {respondendo === true ? "..." : minha === "vou" ? "Eu vou" : "Vou"}
            </button>
            <button
              type="button"
              disabled={respondendo !== null || minha === "nao_vou"}
              onClick={() => void responder(false)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-extrabold transition-colors",
                minha === "nao_vou"
                  ? "bg-destructive/15 text-destructive"
                  : "border border-border text-muted-foreground",
              )}
            >
              <X className="size-4" strokeWidth={3} />
              {respondendo === false ? "..." : minha === "nao_vou" ? "Não vou" : "Não vou"}
            </button>
          </div>
        )}
        {minha === "pendente" && !pelada.comecou && (
          <p className="text-center text-[11px] text-muted-foreground">
            Seu pedido está esperando o organizador. Toque em "Vou" pra entrar direto.
          </p>
        )}

        <Grupo titulo="Vão" pessoas={[...vao, ...pendentes]} userId={userId} cor="text-primary" />

        <button
          type="button"
          onClick={() => setAbertos((a) => !a)}
          className="flex w-full items-center justify-between text-xs font-bold text-muted-foreground"
        >
          <span>
            {naoVao.length} não {naoVao.length === 1 ? "vai" : "vão"} · {semResposta.length} sem
            resposta
          </span>
          <ChevronDown className={cn("size-4 transition-transform", abertos && "rotate-180")} />
        </button>
        {abertos && (
          <>
            <Grupo titulo="Não vão" pessoas={naoVao} userId={userId} cor="text-destructive" />
            <Grupo
              titulo="Sem resposta"
              pessoas={semResposta}
              userId={userId}
              cor="text-muted-foreground"
            />
          </>
        )}
      </div>
    </div>
  );
}

function Grupo({
  titulo,
  pessoas,
  userId,
  cor,
}: {
  titulo: string;
  pessoas: Pessoa[];
  userId: string | null;
  cor: string;
}) {
  if (pessoas.length === 0) return null;
  return (
    <div>
      <p className={cn("mb-1 text-[11px] font-extrabold tracking-wide uppercase", cor)}>
        {titulo} ({pessoas.length})
      </p>
      <ol className="flex flex-wrap gap-1">
        {pessoas.map((p, i) => (
          <li
            key={p.user_id}
            className={cn(
              "rounded-full bg-secondary/70 px-2 py-0.5 text-xs text-foreground",
              p.user_id === userId && "bg-mint-soft font-bold text-primary",
            )}
          >
            {titulo === "Vão" && <span className="mr-1 text-muted-foreground">{i + 1}.</span>}
            {p.nome.split(" ")[0]}
            {p.resposta === "pendente" && (
              <span className="ml-1 text-muted-foreground">(pedido)</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
