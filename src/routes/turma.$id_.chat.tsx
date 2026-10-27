import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  Bell,
  BellOff,
  Clock,
  Copy,
  SendHorizontal,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useVoltar } from "@/hooks/use-voltar";
import { useAvatarUrl } from "@/hooks/use-avatar";
import { marcarChatLido, useChat, useChatsNaoLidos, type Mensagem } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { urlDaFotoDaTurma } from "@/lib/foto-turma";
import { abrirForaDoApp, noApp } from "@/lib/nativo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/turma/$id_/chat")({
  ssr: false,
  head: () => ({ meta: [{ title: "Chat da turma · Goating" }] }),
  component: ChatDaTurma,
});

type Pessoa = { nome: string; foto: string | null };

/** Mensagens da mesma pessoa com menos de 5 min entre elas ficam juntas, sem repetir o nome. */
const JUNTAR_MS = 5 * 60_000;

const mesmoDia = (a: string, b: string) =>
  new Date(a).toDateString() === new Date(b).toDateString();

function rotuloDoDia(iso: string) {
  const data = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (data.toDateString() === hoje.toDateString()) return "Hoje";
  if (data.toDateString() === ontem.toDateString()) return "Ontem";
  return data.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    ...(data.getFullYear() !== hoje.getFullYear() ? { year: "numeric" } : {}),
  });
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Texto com os links (http/https) clicáveis; o resto continua texto puro. */
function comLinks(texto: string, meu: boolean): ReactNode[] {
  return texto.split(/(https?:\/\/[^\s<]+)/g).map((parte, i) =>
    /^https?:\/\//.test(parte) ? (
      <a
        key={i}
        href={parte}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!noApp()) return;
          e.preventDefault();
          void abrirForaDoApp(parte);
        }}
        className={cn("break-all underline", meu ? "text-mint" : "text-primary")}
      >
        {parte}
      </a>
    ) : (
      parte
    ),
  );
}

function ChatDaTurma() {
  const { id } = useParams({ from: "/turma/$id_/chat" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId, carregando: carregandoSessao } = useSession();
  const voltar = useVoltar(() => void navigate({ to: "/turma/$id", params: { id } }));

  useEffect(() => {
    if (!carregandoSessao && !userId) void navigate({ to: "/auth", replace: true });
  }, [carregandoSessao, userId, navigate]);

  const turma = useQuery({
    queryKey: ["chat-turma", id, userId],
    enabled: !!userId,
    queryFn: async () => {
      const [crewRes, membrosRes, membroRes] = await Promise.all([
        supabase.from("crews").select("nome, escudo_url, dono_id").eq("id", id).maybeSingle(),
        supabase
          .from("crew_members")
          .select("user_id, admin")
          .eq("crew_id", id)
          .is("removido_em", null)
          .not("user_id", "is", null),
        supabase.rpc("membro_da_turma", { p_crew_id: id }),
      ]);
      if (crewRes.error) throw crewRes.error;
      const membros = membrosRes.data ?? [];
      const ids = [
        ...new Set([...membros.map((m) => m.user_id!), crewRes.data?.dono_id].filter(Boolean)),
      ] as string[];
      return {
        crew: crewRes.data,
        souMembro: membroRes.data === true,
        souGestor:
          crewRes.data?.dono_id === userId || membros.some((m) => m.user_id === userId && m.admin),
        participantes: ids,
      };
    },
  });
  const souMembro = !!turma.data?.souMembro;

  const chat = useChat(id, userId, souMembro);
  const naoLidos = useChatsNaoLidos(userId);
  const silenciado = naoLidos.silenciado(id);

  // nomes e fotos: quem participa agora e quem já mandou mensagem (mesmo que tenha saído)
  const autores = [
    ...new Set([
      ...(turma.data?.participantes ?? []),
      ...chat.mensagens.flatMap((m) => (m.autor_id ? [m.autor_id] : [])),
    ]),
  ].sort();
  const pessoas = useQuery({
    queryKey: ["chat-pessoas", id, autores.join(",")],
    enabled: autores.length > 0,
    staleTime: 60_000,
    placeholderData: (anterior) => anterior,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome_exibicao, foto_url")
        .in("id", autores);
      if (error) throw error;
      return new Map<string, Pessoa>(
        data.map((p) => [p.id, { nome: p.nome_exibicao, foto: p.foto_url }]),
      );
    },
  });

  // abrir o chat (e cada mensagem nova com a tela à vista) zera as não lidas
  const maisNova = chat.mensagens[0]?.id;
  useEffect(() => {
    if (!souMembro) return;
    const t = setTimeout(() => {
      if (document.visibilityState === "visible") void marcarChatLido(id, queryClient);
    }, 600);
    return () => clearTimeout(t);
  }, [id, souMembro, maisNova, queryClient]);

  const rolagem = useRef<HTMLDivElement>(null);
  const topo = useRef<HTMLDivElement>(null);
  const [longe, setLonge] = useState(false);
  const [novasAbaixo, setNovasAbaixo] = useState(false);
  const [menu, setMenu] = useState<Mensagem | null>(null);

  // mensagem nova de outra pessoa com a tela rolada pra cima: mostra o "↓ novas mensagens"
  const ultimaVista = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const nova = chat.mensagens[0];
    if (!nova || nova.id === ultimaVista.current) return;
    const primeiraCarga = ultimaVista.current === undefined;
    ultimaVista.current = nova.id;
    if (primeiraCarga) return;
    if (nova.autor_id === userId) irProFim();
    else if (longe) setNovasAbaixo(true);
  }, [chat.mensagens, userId, longe]);

  // chegou no alto da conversa: busca as mais antigas
  useEffect(() => {
    const alvo = topo.current;
    const raiz = rolagem.current;
    if (!alvo || !raiz) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting && chat.temMais && !chat.carregandoMais) chat.carregarMais();
      },
      { root: raiz, rootMargin: "300px 0px 0px 0px" },
    );
    obs.observe(alvo);
    return () => obs.disconnect();
  }, [chat]);

  function irProFim() {
    rolagem.current?.scrollTo({ top: 0, behavior: "smooth" });
    setNovasAbaixo(false);
  }

  const crew = turma.data?.crew;
  const escudo = urlDaFotoDaTurma(crew?.escudo_url);
  const mapa = pessoas.data ?? new Map<string, Pessoa>();

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[480px] flex-col bg-background">
      <header className="flex items-center gap-3 bg-primary px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <button type="button" aria-label="Voltar" onClick={voltar} className="p-1">
          <ArrowLeft className="size-5 text-primary-foreground" />
        </button>
        <Link to="/turma/$id" params={{ id }} className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-mint/15">
            {escudo ? (
              <img src={escudo} alt="" className="size-full object-cover" />
            ) : (
              <Users className="size-5 text-mint" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base leading-tight font-extrabold text-primary-foreground">
              {crew?.nome ?? "Turma"}
            </span>
            <span className="block text-xs text-mint">
              {turma.data
                ? `${turma.data.participantes.length} ${turma.data.participantes.length === 1 ? "participante" : "participantes"}`
                : " "}
            </span>
          </span>
        </Link>
        {souMembro && (
          <button
            type="button"
            aria-label={silenciado ? "Voltar a receber avisos" : "Silenciar avisos deste chat"}
            onClick={async () => {
              const { error } = await supabase.rpc("silenciar_chat", {
                p_crew_id: id,
                p_silenciar: !silenciado,
              });
              if (error) return void toast.error("Não deu pra mudar os avisos.");
              await queryClient.invalidateQueries({ queryKey: ["chats-nao-lidos"] });
              toast.success(
                silenciado ? "Avisos do chat ligados." : "Chat silenciado. Sem avisos no celular.",
              );
            }}
            className="flex size-9 items-center justify-center rounded-full bg-mint/15 text-mint"
          >
            {silenciado ? <BellOff className="size-4" /> : <Bell className="size-4" />}
          </button>
        )}
      </header>

      {turma.isLoading || carregandoSessao ? (
        <div className="flex-1 space-y-3 p-4">
          <Skeleton className="h-10 w-2/3 rounded-2xl" />
          <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
          <Skeleton className="h-16 w-3/4 rounded-2xl" />
        </div>
      ) : !souMembro ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Só quem é da turma participa do chat. Entre na turma pra conversar com a galera.
          </p>
          <Button asChild>
            <Link to="/turma/$id" params={{ id }}>
              Ver a turma
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="relative min-h-0 flex-1">
            <div
              ref={rolagem}
              onScroll={(e) => {
                // a lista é de baixo pra cima: 0 é o fim da conversa
                const distante = Math.abs(e.currentTarget.scrollTop) > 300;
                setLonge(distante);
                if (!distante) setNovasAbaixo(false);
              }}
              className="flex h-full flex-col-reverse overflow-y-auto bg-secondary/40 px-3 py-3"
            >
              {chat.carregando ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-2/3 rounded-2xl" />
                  <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
                </div>
              ) : chat.mensagens.length === 0 ? (
                <div className="m-auto max-w-[260px] rounded-2xl bg-card p-4 text-center shadow-sm">
                  <p className="text-2xl">👋</p>
                  <p className="mt-1 text-sm font-bold text-foreground">Chat da turma</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Combina a pelada, manda a lista, zoa o perna de pau. Só quem é da turma vê.
                  </p>
                </div>
              ) : (
                chat.mensagens.map((m, i) => {
                  const maisNovaQue = chat.mensagens[i - 1];
                  const maisVelha = chat.mensagens[i + 1];
                  const novoDia = !maisVelha || !mesmoDia(maisVelha.criado_em, m.criado_em);
                  const comecaGrupo =
                    novoDia ||
                    maisVelha.autor_id !== m.autor_id ||
                    maisVelha.tipo !== "texto" ||
                    new Date(m.criado_em).getTime() - new Date(maisVelha.criado_em).getTime() >
                      JUNTAR_MS;
                  const fechaGrupo =
                    !maisNovaQue ||
                    maisNovaQue.autor_id !== m.autor_id ||
                    !mesmoDia(maisNovaQue.criado_em, m.criado_em) ||
                    new Date(maisNovaQue.criado_em).getTime() - new Date(m.criado_em).getTime() >
                      JUNTAR_MS;
                  return (
                    <div key={m.id}>
                      {novoDia && (
                        <div className="my-3 flex justify-center">
                          <span className="rounded-full bg-card px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
                            {rotuloDoDia(m.criado_em)}
                          </span>
                        </div>
                      )}
                      <Balao
                        mensagem={m}
                        meu={m.autor_id === userId}
                        autor={m.autor_id ? mapa.get(m.autor_id) : undefined}
                        mostraNome={comecaGrupo}
                        mostraFoto={fechaGrupo}
                        juntoDoAnterior={!comecaGrupo}
                        onMenu={() => setMenu(m)}
                      />
                    </div>
                  );
                })
              )}
              <div ref={topo} className="h-px shrink-0" />
              {chat.carregandoMais && (
                <p className="py-2 text-center text-xs text-muted-foreground">Carregando...</p>
              )}
            </div>

            {(novasAbaixo || longe) && (
              <button
                type="button"
                onClick={irProFim}
                className={cn(
                  "absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-xs font-bold shadow-lg",
                  novasAbaixo ? "text-primary" : "text-muted-foreground",
                )}
              >
                <ArrowDown className="size-4" />
                {novasAbaixo && "Novas mensagens"}
              </button>
            )}
          </div>

          <CampoDeMensagem onEnviar={chat.enviar} />
        </>
      )}

      {menu && (
        <MenuDaMensagem
          mensagem={menu}
          podeApagar={
            !menu.apagada_em &&
            !menu.pendente &&
            (menu.autor_id === userId || !!turma.data?.souGestor)
          }
          onApagar={() => void chat.apagar(menu.id)}
          onFechar={() => setMenu(null)}
        />
      )}
    </div>
  );
}

function Balao({
  mensagem,
  meu,
  autor,
  mostraNome,
  mostraFoto,
  juntoDoAnterior,
  onMenu,
}: {
  mensagem: Mensagem;
  meu: boolean;
  autor: Pessoa | undefined;
  mostraNome: boolean;
  mostraFoto: boolean;
  juntoDoAnterior: boolean;
  onMenu: () => void;
}) {
  const foto = useAvatarUrl(!meu && mostraFoto ? autor?.foto : null);
  const segurar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soltar = () => {
    if (segurar.current) clearTimeout(segurar.current);
    segurar.current = null;
  };
  const apagada = !!mensagem.apagada_em;

  return (
    <div
      className={cn(
        "flex items-end gap-1.5",
        meu ? "justify-end" : "justify-start",
        juntoDoAnterior ? "mt-0.5" : "mt-2.5",
      )}
    >
      {!meu && (
        <span className="size-7 shrink-0">
          {mostraFoto &&
            (foto ? (
              <img src={foto} alt="" className="size-7 rounded-full object-cover" />
            ) : (
              <span className="flex size-7 items-center justify-center rounded-full bg-mint-soft text-[11px] font-bold text-primary">
                {(autor?.nome ?? "?").slice(0, 1).toUpperCase()}
              </span>
            ))}
        </span>
      )}
      <div
        onPointerDown={() => {
          soltar();
          segurar.current = setTimeout(onMenu, 450);
        }}
        onPointerUp={soltar}
        onPointerLeave={soltar}
        onPointerMove={(e) => {
          if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) soltar();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu();
        }}
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-1.5 text-sm shadow-sm select-text",
          meu
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-card text-foreground",
          mensagem.pendente && "opacity-70",
        )}
      >
        {!meu && mostraNome && (
          <p className="mb-0.5 text-xs font-extrabold text-primary">{autor?.nome ?? "Ex-membro"}</p>
        )}
        {apagada ? (
          <p className={cn("italic", meu ? "text-primary-foreground/70" : "text-muted-foreground")}>
            Mensagem apagada
          </p>
        ) : (
          <p className="break-words whitespace-pre-wrap">{comLinks(mensagem.texto ?? "", meu)}</p>
        )}
        <p
          className={cn(
            "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
            meu ? "text-primary-foreground/60" : "text-muted-foreground",
          )}
        >
          {mensagem.pendente && <Clock className="size-3" />}
          {hora(mensagem.criado_em)}
        </p>
      </div>
    </div>
  );
}

function CampoDeMensagem({ onEnviar }: { onEnviar: (texto: string) => Promise<boolean> }) {
  const [texto, setTexto] = useState("");
  const campo = useRef<HTMLTextAreaElement>(null);
  // no computador o Enter manda (Shift+Enter quebra a linha); no celular o Enter quebra a linha
  const tecladoFisico =
    typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches;

  useLayoutEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [texto]);

  function mandar() {
    const atual = texto.trim();
    if (!atual) return;
    setTexto("");
    campo.current?.focus();
    void onEnviar(atual).then((ok) => {
      if (!ok) setTexto((t) => t || atual);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mandar();
      }}
      className="flex items-end gap-2 border-t border-border bg-card px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]"
    >
      <textarea
        ref={campo}
        value={texto}
        rows={1}
        maxLength={2000}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (tecladoFisico && e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            mandar();
          }
        }}
        placeholder="Mensagem"
        aria-label="Mensagem"
        className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-input bg-background px-3.5 py-2 text-sm leading-snug outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
      <button
        type="submit"
        aria-label="Enviar"
        disabled={!texto.trim()}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-mint transition-opacity disabled:opacity-40"
      >
        <SendHorizontal className="size-5" />
      </button>
    </form>
  );
}

function MenuDaMensagem({
  mensagem,
  podeApagar,
  onApagar,
  onFechar,
}: {
  mensagem: Mensagem;
  podeApagar: boolean;
  onApagar: () => void;
  onFechar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-label="Opções da mensagem"
        className="w-full max-w-[480px] space-y-2 rounded-t-3xl bg-card p-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]"
      >
        {mensagem.texto && !mensagem.apagada_em && (
          <p className="line-clamp-3 rounded-2xl bg-secondary/60 px-3 py-2 text-sm text-foreground">
            {mensagem.texto}
          </p>
        )}
        {mensagem.texto && !mensagem.apagada_em && (
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(mensagem.texto ?? "")
                .then(() => toast.success("Copiado."));
              onFechar();
            }}
          >
            <Copy className="mr-2 size-4" /> Copiar
          </Button>
        )}
        {podeApagar &&
          (confirmando ? (
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                onApagar();
                onFechar();
              }}
            >
              <Trash2 className="mr-2 size-4" /> Apagar pra todo mundo
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start text-destructive"
              onClick={() => setConfirmando(true)}
            >
              <Trash2 className="mr-2 size-4" /> Apagar
            </Button>
          ))}
        <Button variant="ghost" className="w-full" onClick={onFechar}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
