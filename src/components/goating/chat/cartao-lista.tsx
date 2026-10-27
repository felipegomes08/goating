import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Check, ChevronDown, ClipboardList, MapPin, X } from "lucide-react";
import {
  type PessoaDaLista,
  type RespostaDaLista,
  useListaDaPelada,
} from "@/hooks/use-lista-da-pelada";
import { cn } from "@/lib/utils";
import { quandoDaPelada } from "@/lib/quando-da-pelada";

/**
 * Cartão da lista de confirmação no chat: a pelada, quem vai, quem não vai e quem ainda não
 * respondeu. Quem não respondeu vê "Vou" e "Não vou"; quem já respondeu vê a resposta e
 * "Mudar resposta". O "Vou" já coloca a pessoa na pelada.
 */
export function CartaoLista({
  matchId,
  userId,
  encerrada = false,
}: {
  matchId: string;
  userId: string | null;
  /** o organizador encerrou a lista: fica só pra consulta */
  encerrada?: boolean;
}) {
  const lista = useListaDaPelada(matchId, userId);
  const [abertos, setAbertos] = useState(false);
  const [mudando, setMudando] = useState(false);

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
  const minha = lista.minha;
  const vao = pessoas.filter((p) => p.resposta === "vou");
  const pendentes = pessoas.filter((p) => p.resposta === "pendente");
  const naoVao = pessoas.filter((p) => p.resposta === "nao_vou");
  const semResposta = pessoas.filter((p) => p.resposta === null);
  const lotou = pelada.confirmados >= pelada.vagas;
  const fechada = pelada.comecou || encerrada;
  const respondida = minha === "vou" || minha === "nao_vou";

  async function responder(vou: boolean) {
    if (await lista.responder(vou)) setMudando(false);
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-sm">
      <div className="bg-primary px-4 py-3">
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-mint uppercase">
          <ClipboardList className="size-3.5" /> Lista da pelada
          {encerrada && <span className="ml-1 text-primary-foreground/60">· encerrada</span>}
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

        {fechada ? (
          <p className="rounded-xl bg-secondary/60 px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
            {pelada.comecou
              ? "A pelada já começou: a lista fechou."
              : "Lista encerrada pelo organizador. Dá pra confirmar na tela da pelada."}
          </p>
        ) : respondida && !mudando ? (
          <MinhaResposta resposta={minha} onMudar={() => setMudando(true)} />
        ) : (
          <BotoesDaResposta
            minha={minha}
            lotou={lotou}
            respondendo={lista.respondendo}
            onResponder={(vou) => void responder(vou)}
            onCancelar={mudando ? () => setMudando(false) : undefined}
          />
        )}
        {minha === "pendente" && !fechada && (
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

/** "✓ Você vai" (ou "Você não vai") com o "Mudar resposta" do lado. */
export function MinhaResposta({
  resposta,
  onMudar,
  compacta = false,
}: {
  resposta: RespostaDaLista;
  onMudar: () => void;
  compacta?: boolean;
}) {
  const vai = resposta === "vou";
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-xl px-3",
        compacta ? "py-1.5" : "py-2.5",
        vai ? "bg-mint-soft text-primary" : "bg-destructive/10 text-destructive",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-extrabold">
        {vai ? (
          <Check className="size-4" strokeWidth={3} />
        ) : (
          <X className="size-4" strokeWidth={3} />
        )}
        {vai ? "Você vai" : "Você não vai"}
      </span>
      <button
        type="button"
        onClick={onMudar}
        className="text-xs font-semibold text-muted-foreground underline"
      >
        Mudar resposta
      </button>
    </div>
  );
}

export function BotoesDaResposta({
  minha,
  lotou,
  respondendo,
  onResponder,
  onCancelar,
  compacta = false,
}: {
  minha: RespostaDaLista;
  lotou: boolean;
  respondendo: boolean | null;
  onResponder: (vou: boolean) => void;
  onCancelar?: (() => void) | undefined;
  compacta?: boolean;
}) {
  const altura = compacta ? "py-1.5 text-xs" : "py-2.5 text-sm";
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={respondendo !== null || minha === "vou" || lotou}
          onClick={() => onResponder(true)}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl bg-mint font-extrabold text-mint-foreground disabled:opacity-40",
            altura,
          )}
        >
          <Check className="size-4" strokeWidth={3} />
          {respondendo === true ? "..." : lotou && minha !== "vou" ? "Lotou" : "Vou"}
        </button>
        <button
          type="button"
          disabled={respondendo !== null || minha === "nao_vou"}
          onClick={() => onResponder(false)}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl border border-border font-extrabold text-muted-foreground disabled:opacity-40",
            altura,
          )}
        >
          <X className="size-4" strokeWidth={3} />
          {respondendo === false ? "..." : "Não vou"}
        </button>
      </div>
      {onCancelar && (
        <button
          type="button"
          onClick={onCancelar}
          className="w-full text-center text-xs font-semibold text-muted-foreground underline"
        >
          Deixar como está
        </button>
      )}
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
  pessoas: PessoaDaLista[];
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
