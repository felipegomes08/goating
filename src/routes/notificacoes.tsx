import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bell,
  BellRing,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  Crown,
  Gift,
  MessageSquareText,
  ShieldCheck,
  Star,
  UserMinus,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useVoltar } from "@/hooks/use-voltar";
import { useNotificacoes, type Notificacao } from "@/hooks/use-notificacoes";
import { BottomNav } from "@/components/goating/bottom-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  ligarPushNoApp,
  lerEstadoDoPush,
  noApp,
  ouvirEstadoDoPush,
  type EstadoDoPush,
} from "@/lib/nativo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notificacoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Notificações · Goating" }] }),
  component: Notificacoes,
});

/** Ícone de cada tipo de aviso. */
const ICONE: Record<string, LucideIcon> = {
  confirmou: UserPlus,
  pedido_pelada: UserPlus,
  pedido_aceito: UserPlus,
  lotou: Users,
  desistiu: UserMinus,
  tirado: UserMinus,
  lembrete: CalendarClock,
  lembrete_org: CalendarClock,
  nova_pelada: CalendarPlus,
  mudou: CalendarClock,
  cancelada: CalendarX,
  entrou_turma: Users,
  pedido_turma: Users,
  pedido_aceito_turma: Users,
  admin: ShieldCheck,
  avaliar: Star,
  avaliar_fim: Star,
  mvp: Crown,
  mvp_voce: Crown,
  subiu: Gift,
  colega_subiu: Gift,
  seguidor: UserPlus,
  comentario: MessageSquareText,
};

/** Grupos de aviso que a pessoa pode desligar no celular (o sino continua recebendo tudo). */
const GRUPOS_DE_AVISO = [
  { id: "peladas", nome: "Minhas peladas", texto: "Nova pelada, lembrete, mudança e cancelamento" },
  {
    id: "organizador",
    nome: "Peladas que organizo",
    texto: "Confirmações, pedidos, desistências e lotação",
  },
  { id: "turma", nome: "Turma", texto: "Quem entrou, pedidos e administradores" },
  { id: "avaliacao", nome: "Avaliação e MVP", texto: "Avaliações abertas, prazo e MVP" },
  { id: "conquistas", nome: "Conquistas", texto: "Você ou colegas subindo de nível" },
  { id: "social", nome: "Seguidores e comentários", texto: "Novo seguidor e comentário no perfil" },
] as const;

/** Tipos que pedem destaque dourado (conquista). */
const DOURADO = new Set(["mvp_voce", "subiu", "lotou"]);

function grupoDe(data: Date) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dia = new Date(data);
  dia.setHours(0, 0, 0, 0);
  const dias = Math.round((hoje.getTime() - dia.getTime()) / 86_400_000);
  return dias <= 0 ? "Hoje" : dias === 1 ? "Ontem" : "Antes";
}

function horaOuData(data: Date) {
  return grupoDe(data) === "Antes"
    ? data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Notificacoes() {
  const navigate = useNavigate();
  const router = useRouter();
  const { userId, carregando } = useSession();
  const {
    lista,
    carregando: carregandoLista,
    naoLidas,
    marcarLida,
    marcarTodas,
  } = useNotificacoes(userId);
  const voltar = useVoltar(() => void navigate({ to: "/", replace: true }));

  useEffect(() => {
    if (!carregando && !userId) void navigate({ to: "/auth", replace: true });
  }, [carregando, userId, navigate]);

  function abrir(n: Notificacao) {
    void marcarLida(n.id);
    if (n.link) router.history.push(n.link);
  }

  const grupos = (["Hoje", "Ontem", "Antes"] as const)
    .map((titulo) => ({
      titulo,
      itens: lista.filter((n) => grupoDe(new Date(n.criado_em)) === titulo),
    }))
    .filter((g) => g.itens.length > 0);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-background">
      <header className="flex items-center gap-3 bg-primary px-4 py-4">
        <button type="button" aria-label="Voltar" onClick={voltar}>
          <ArrowLeft className="size-5 text-primary-foreground" />
        </button>
        <h1 className="min-w-0 flex-1 text-lg font-extrabold text-primary-foreground">
          Notificações
        </h1>
        {naoLidas > 0 && (
          <button
            type="button"
            onClick={() => void marcarTodas()}
            className="text-xs font-semibold text-mint"
          >
            Marcar todas como lidas
          </button>
        )}
      </header>

      <main className="flex-1 space-y-4 px-4 py-4">
        {userId && noApp() && <AvisosNoCelular userId={userId} />}
        {carregando || carregandoLista ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
        ) : grupos.length === 0 ? (
          <div className="mt-16 space-y-2 text-center">
            <Bell className="mx-auto size-10 text-muted-foreground" />
            <p className="text-base font-semibold text-foreground">Nada por aqui ainda</p>
            <p className="text-sm text-muted-foreground">
              Avisos de pelada, turma, avaliação e MVP aparecem aqui.
            </p>
          </div>
        ) : (
          grupos.map((g) => (
            <section key={g.titulo} className="space-y-2">
              <h2 className="px-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                {g.titulo}
              </h2>
              <ul className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]">
                {g.itens.map((n) => {
                  const Icone = ICONE[n.tipo] ?? Bell;
                  const dourado = DOURADO.has(n.tipo);
                  return (
                    <li key={n.id} className="border-b border-border last:border-0">
                      <button
                        type="button"
                        onClick={() => abrir(n)}
                        className={cn(
                          "flex w-full items-start gap-3 px-3 py-3 text-left active:bg-secondary/60",
                          !n.lida_em && "bg-mint-soft/50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full",
                            dourado
                              ? "bg-tier-ouro/20 text-tier-ouro"
                              : "bg-secondary text-primary",
                          )}
                        >
                          <Icone className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block text-sm text-foreground",
                              n.lida_em ? "font-semibold" : "font-extrabold",
                            )}
                          >
                            {n.titulo}
                          </span>
                          {n.corpo && (
                            <span className="block text-xs text-muted-foreground">{n.corpo}</span>
                          )}
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {horaOuData(new Date(n.criado_em))}
                          </span>
                          {!n.lida_em && (
                            <span className="size-2 rounded-full bg-primary" aria-label="Nova" />
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}

/** Chaves por grupo: liga e desliga os avisos que chegam no celular com o app fechado. */
function AvisosNoCelular({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<EstadoDoPush>(lerEstadoDoPush);
  useEffect(() => ouvirEstadoDoPush(setEstado), []);
  const chave = ["push-desligados", userId];
  const { data: desligados = [] } = useQuery({
    queryKey: chave,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("push_desligados")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.push_desligados ?? [];
    },
  });

  async function alternar(grupo: string, ligado: boolean) {
    const novo = ligado ? desligados.filter((g) => g !== grupo) : [...desligados, grupo];
    queryClient.setQueryData(chave, novo);
    const { error } = await supabase
      .from("profiles")
      .update({ push_desligados: novo })
      .eq("id", userId);
    if (error) void queryClient.invalidateQueries({ queryKey: chave });
  }

  return (
    <section className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-3 text-left"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
          <BellRing className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">Avisos no celular</span>
          <span className="block text-xs text-muted-foreground">
            Escolha o que chega com o app fechado
          </span>
        </span>
        <span className="text-xs font-semibold text-primary">{aberto ? "Fechar" : "Ajustar"}</span>
      </button>
      {aberto && (
        <div className="flex items-center gap-3 border-t border-border px-3 py-3">
          <span
            className={cn(
              "min-w-0 flex-1 text-xs",
              estado.tipo === "ok" ? "text-primary" : "text-muted-foreground",
            )}
          >
            {estado.tipo === "ok"
              ? "Este celular está recebendo avisos."
              : estado.tipo === "registrando"
                ? "Ativando os avisos neste celular…"
                : estado.tipo === "sem-permissao"
                  ? "Notificações bloqueadas. Libere nas configurações do celular."
                  : estado.tipo === "erro"
                    ? `Não deu pra ativar: ${estado.mensagem}`
                    : "Avisos ainda não ativados neste celular."}
          </span>
          {estado.tipo !== "ok" && estado.tipo !== "registrando" && (
            <button
              type="button"
              onClick={() => void ligarPushNoApp()}
              className="shrink-0 text-xs font-semibold text-primary"
            >
              Ativar de novo
            </button>
          )}
        </div>
      )}
      {aberto && (
        <ul className="border-t border-border">
          {GRUPOS_DE_AVISO.map((g) => {
            const ligado = !desligados.includes(g.id);
            return (
              <li
                key={g.id}
                className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{g.nome}</span>
                  <span className="block text-xs text-muted-foreground">{g.texto}</span>
                </span>
                <Switch
                  checked={ligado}
                  onCheckedChange={(v) => void alternar(g.id, v)}
                  aria-label={g.nome}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
