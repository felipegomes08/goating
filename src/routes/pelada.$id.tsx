import { useState } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCheck,
  Crown,
  Flag,
  Lock,
  LogOut,
  MapPin,
  MessageSquareText,
  Play,
  Share2,
  Star,
  Trophy,
  Pencil,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAvatarUrl } from "@/hooks/use-avatar";
import { useSession } from "@/hooks/use-session";
import { useVoltar } from "@/hooks/use-voltar";
import { Button } from "@/components/ui/button";
import { avaliouTodos } from "@/components/goating/match-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { podeGerirPelada } from "@/lib/placar/dados";
import { tierPorNome } from "@/lib/tiers";
import { TierBadge } from "@/components/goating/tier-badge";

export const Route = createFileRoute("/pelada/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Detalhes da pelada · Goating" },
      {
        name: "description",
        content: "Veja os confirmados, entre na pelada e avalie os jogadores depois do jogo.",
      },
      { property: "og:title", content: "Detalhes da pelada · Goating" },
      {
        property: "og:description",
        content: "Confirmados, local, horário e avaliação pós-jogo da sua pelada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DetalhePelada,
  errorComponent: () => <Aviso texto="Não conseguimos carregar essa pelada." />,
  notFoundComponent: () => <Aviso texto="Essa pelada não existe mais." />,
});

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="app-shell flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm text-muted-foreground">{texto}</p>
      <Button asChild>
        <Link to="/">Voltar ao feed</Link>
      </Button>
    </div>
  );
}

type Participante = {
  id: string;
  user_id: string;
  status: string;
  nome: string;
  overall: number | string | null;
  tier_reconhecido: string | null;
  foto: string | null;
};

function iniciais(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function dataLonga(data: string, horario: string, horarioFim?: string | null) {
  const d = new Date(`${data}T${horario}`);
  const faixa = horarioFim
    ? `${horario.slice(0, 5)} às ${horarioFim.slice(0, 5)}`
    : horario.slice(0, 5);
  return (
    d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }) + ` · ${faixa}`
  );
}

function DetalhePelada() {
  const { id } = useParams({ from: "/pelada/$id" });
  const { userId, carregando } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const voltar = useVoltar(() => void navigate({ to: "/", replace: true }));
  const [ocupado, setOcupado] = useState(false);
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);

  const consulta = useQuery({
    queryKey: ["pelada", id, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: pelada, error } = await supabase
        .from("matches")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!pelada) return null;

      const [{ data: parts }, { data: convite }, { data: minhasAvaliacoes }, { data: elenco }] =
        await Promise.all([
          supabase.from("match_participants").select("id, user_id, status").eq("match_id", id),
          supabase
            .from("match_invite_links")
            .select("token")
            .eq("match_id", id)
            .eq("ativo", true)
            .maybeSingle(),
          supabase
            .from("evaluations")
            .select("avaliado_id")
            .eq("match_id", id)
            .eq("avaliador_id", userId!),
          supabase
            .from("match_players")
            .select("member_id, time, crew_members(nome, user_id)")
            .eq("match_id", id),
        ]);
      const podeGerir = await podeGerirPelada(pelada, userId!);

      const ids = [...new Set([...(parts ?? []).map((p) => p.user_id), pelada.organizador_id])];
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nome_exibicao, overall, tier_reconhecido, foto_url")
        .in("id", ids);

      const lista: Participante[] = (parts ?? []).map((p) => {
        const perfil = (perfis ?? []).find((x) => x.id === p.user_id);
        return {
          id: p.id,
          user_id: p.user_id,
          status: p.status,
          nome: perfil?.nome_exibicao ?? "Jogador",
          overall: perfil?.overall ?? null,
          tier_reconhecido: perfil?.tier_reconhecido ?? null,
          foto: perfil?.foto_url ?? null,
        };
      });

      return {
        pelada,
        podeGerir,
        participantes: lista,
        organizador: (perfis ?? []).find((x) => x.id === pelada.organizador_id) ?? null,
        token: convite?.token ?? null,
        avaliadosPorMim: (minhasAvaliacoes ?? []).map((a) => a.avaliado_id),
        timesMontados:
          new Set((elenco ?? []).flatMap((j) => (j.time === null ? [] : [j.time]))).size >= 2,
        // quem o organizador colocou no elenco e não confirmou pelo app (lista colada, sem conta...)
        adicionados: (elenco ?? [])
          .filter(
            (j) =>
              !j.crew_members?.user_id ||
              !(parts ?? []).some(
                (x) => x.user_id === j.crew_members?.user_id && x.status === "aprovado",
              ),
          )
          .map((j) => ({ id: j.member_id, nome: j.crew_members?.nome ?? "Jogador" }))
          .sort((a, b) => a.nome.localeCompare(b.nome)),
      };
    },
  });

  if (carregando || consulta.isLoading) {
    return (
      <div className="app-shell space-y-3 p-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="app-shell flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">Entre na sua conta para ver essa pelada.</p>
        <Button asChild>
          <Link to="/auth">Entrar no Goating</Link>
        </Button>
      </div>
    );
  }

  if (!consulta.data) return <Aviso texto="Essa pelada não existe mais." />;

  const {
    pelada,
    podeGerir,
    participantes,
    organizador,
    token,
    avaliadosPorMim,
    timesMontados,
    adicionados,
  } = consulta.data;
  const souOrganizador = pelada.organizador_id === userId;
  const aprovados = participantes.filter((p) => p.status === "aprovado");
  const pendentes = participantes.filter((p) => p.status === "pendente");
  const eu = participantes.find((p) => p.user_id === userId);
  const lotado = aprovados.length >= pelada.quantidade_vagas;
  const finalizada = pelada.status === "finalizada";
  const emAndamento = pelada.status === "em_andamento";
  const temPlacar = !!pelada.placar_finalizado_em;
  // finalizar só faz sentido depois que a pelada começou
  const jaComecou = new Date(`${pelada.data}T${pelada.horario}`).getTime() <= Date.now();
  const mvpNome = pelada.mvp_id
    ? (participantes.find((p) => p.user_id === pelada.mvp_id)?.nome ?? null)
    : null;
  const dentroDaJanela =
    finalizada &&
    !!pelada.finalizada_em &&
    Date.now() - new Date(pelada.finalizada_em).getTime() < 24 * 60 * 60 * 1000;
  const jaAvaliei = avaliouTodos(participantes, avaliadosPorMim, userId);
  const fimDaJanela = pelada.finalizada_em
    ? new Date(new Date(pelada.finalizada_em).getTime() + 24 * 60 * 60 * 1000)
    : null;
  const fimDaJanelaTexto = fimDaJanela
    ? `${fimDaJanela.toDateString() === new Date().toDateString() ? "hoje" : "amanhã"} às ${fimDaJanela.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : null;
  const linkConvite = token ? `${window.location.origin}/p/${token}` : null;

  async function atualizar() {
    await queryClient.invalidateQueries({ queryKey: ["pelada", id] });
    await queryClient.invalidateQueries({ queryKey: ["feed"] });
  }

  async function entrar() {
    setOcupado(true);
    const { error } = await supabase.from("match_participants").insert({
      match_id: id,
      user_id: userId!,
      status: pelada.tipo === "aberta" ? "aprovado" : "pendente",
    });
    setOcupado(false);
    if (error) {
      toast.error("Não deu pra entrar. A pelada pode ter lotado.");
      return;
    }
    toast.success(pelada.tipo === "aberta" ? "Você está dentro!" : "Solicitação enviada.");
    await atualizar();
  }

  async function sair() {
    setOcupado(true);
    const { error } = await supabase.from("match_participants").delete().eq("id", eu!.id);
    setOcupado(false);
    if (error) {
      toast.error("Não deu pra sair da pelada.");
      return;
    }
    toast.success("Você saiu da pelada.");
    await atualizar();
  }

  async function decidir(participanteId: string, status: "aprovado" | "recusado") {
    setOcupado(true);
    const { error } =
      status === "aprovado"
        ? await supabase.from("match_participants").update({ status }).eq("id", participanteId)
        : await supabase.from("match_participants").delete().eq("id", participanteId);
    setOcupado(false);
    if (error) {
      toast.error("Não deu pra atualizar esse jogador.");
      return;
    }
    await atualizar();
  }

  async function apagar() {
    setOcupado(true);
    const { error } = await supabase.from("matches").delete().eq("id", id);
    setOcupado(false);
    if (error) {
      toast.error("Não deu pra apagar a pelada.");
      return;
    }
    toast.success("Pelada apagada.");
    await queryClient.invalidateQueries({ queryKey: ["feed"] });
    await queryClient.invalidateQueries({ queryKey: ["turma"] });
    await queryClient.invalidateQueries({ queryKey: ["minhas-turmas-resumo"] });
    await navigate({ to: "/", replace: true });
  }

  async function finalizar() {
    setOcupado(true);
    const { error } = await supabase
      .from("matches")
      .update({ status: "finalizada", finalizada_em: new Date().toISOString() })
      .eq("id", id);
    setOcupado(false);
    if (error) {
      toast.error("Não deu pra finalizar a pelada.");
      return;
    }
    toast.success("Pelada finalizada! Agora todo mundo pode avaliar por 24h.");
    await atualizar();
  }

  return (
    <div className="app-shell flex min-h-dvh flex-col">
      <header className={cn("px-4 pt-4 pb-5", finalizada ? "bg-neutral-900" : "bg-primary")}>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Voltar" onClick={voltar}>
            <ArrowLeft className="size-5 text-primary-foreground" />
          </button>
          {finalizada ? (
            <span className="flex items-center gap-1 text-xs font-bold tracking-wide text-destructive uppercase">
              <Flag className="size-3.5" /> Pelada finalizada
            </span>
          ) : (
            <span className="text-xs font-semibold tracking-wide text-mint uppercase">
              {pelada.tipo === "aberta" ? "Pelada aberta" : "Pelada fechada"}
            </span>
          )}
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-primary-foreground">{pelada.titulo}</h1>
        <p className={cn("mt-1 text-sm", finalizada ? "text-primary-foreground/60" : "text-mint")}>
          por {organizador?.nome_exibicao ?? "organizador"}
        </p>
      </header>

      <div className="space-y-4 p-4">
        <div className="divide-y divide-border rounded-2xl bg-card shadow-[var(--shadow-card)]">
          <p className="flex items-center gap-2 px-4 py-3 text-sm text-foreground">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span className="capitalize">
              {dataLonga(pelada.data, pelada.horario, pelada.horario_fim)}
            </span>
          </p>
          <p className="flex items-center gap-2 px-4 py-3 text-sm text-foreground">
            <MapPin className="size-4 text-muted-foreground" />
            {pelada.local} · {pelada.cidade}
          </p>
          <p className="flex items-center gap-2 px-4 py-3 text-sm text-foreground">
            {finalizada ? (
              <Flag className="size-4 text-destructive" />
            ) : pelada.tipo === "aberta" ? (
              <Check className="size-4 text-muted-foreground" />
            ) : (
              <Lock className="size-4 text-muted-foreground" />
            )}
            {aprovados.length}/{pelada.quantidade_vagas} {finalizada ? "jogaram" : "confirmados"}
          </p>
          {pelada.descricao && (
            <div className="flex gap-2 px-4 py-3 text-sm text-foreground">
              <MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="min-w-0 break-words whitespace-pre-line">{pelada.descricao}</p>
            </div>
          )}
        </div>

        {finalizada && mvpNome && (
          <div className="flex items-center gap-2 rounded-2xl border border-tier-ouro/40 bg-tier-ouro/10 px-4 py-3">
            <Crown className="size-4 text-tier-ouro" />
            <p className="text-sm font-semibold text-foreground">MVP da partida: {mvpNome}</p>
          </div>
        )}

        {temPlacar && (
          <Button
            asChild
            variant={
              dentroDaJanela && eu?.status === "aprovado" && aprovados.length > 1 && !jaAvaliei
                ? "outline"
                : "default"
            }
            className="w-full"
          >
            <Link to="/pelada/$id/resumo" params={{ id }}>
              <Trophy className="mr-2 size-4" /> Ver placar e artilharia
            </Link>
          </Button>
        )}

        {pelada.crew_id && (
          <Button asChild variant="outline" className="w-full">
            <Link to="/turma/$id" params={{ id: pelada.crew_id }}>
              <Trophy className="mr-2 size-4" /> Ranking da turma
            </Link>
          </Button>
        )}

        {!finalizada && linkConvite && (souOrganizador || eu?.status === "aprovado") && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              void navigator.clipboard.writeText(linkConvite);
              toast.success("Link de convite copiado!");
            }}
          >
            <Share2 className="mr-2 size-4" /> Copiar link de convite
          </Button>
        )}

        {!finalizada && souOrganizador && pendentes.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-bold text-foreground">
              Pedidos para entrar ({pendentes.length})
            </h2>
            <div className="space-y-2">
              {pendentes.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]"
                >
                  <Avatar nome={p.nome} foto={p.foto} />
                  <span className="flex-1 text-sm font-semibold text-foreground">{p.nome}</span>
                  <button
                    aria-label={`Recusar ${p.nome}`}
                    disabled={ocupado}
                    onClick={() => decidir(p.id, "recusado")}
                    className="flex size-8 items-center justify-center rounded-lg bg-secondary"
                  >
                    <X className="size-4" />
                  </button>
                  <button
                    aria-label={`Aprovar ${p.nome}`}
                    disabled={ocupado || lotado}
                    onClick={() => decidir(p.id, "aprovado")}
                    className="flex size-8 items-center justify-center rounded-lg bg-mint text-mint-foreground"
                  >
                    <Check className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-bold text-foreground">
            {finalizada ? "Jogaram" : "Confirmados"} ({aprovados.length})
          </h2>
          <div className="space-y-2">
            {aprovados.length === 0 && (
              <p className="text-sm text-muted-foreground">Ninguém confirmado ainda.</p>
            )}
            {aprovados.map((p) => {
              const tier = tierPorNome(p.tier_reconhecido);
              const ehMvp = pelada.mvp_id === p.user_id;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]"
                >
                  <Avatar nome={p.nome} foto={p.foto} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <TierBadge tier={tier} overall={p.overall} size={18} />
                      <span className="truncate">{p.nome}</span>
                      {p.user_id === pelada.organizador_id && (
                        <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
                          ORG
                        </span>
                      )}
                    </p>
                    {tier && (
                      <span
                        className={cn(
                          "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold",
                          tier.chipClass,
                        )}
                      >
                        {tier.nome}
                      </span>
                    )}
                  </div>
                  {ehMvp && (
                    <span
                      title={
                        finalizada && !dentroDaJanela
                          ? "Craque da partida"
                          : "Craque da partida (provisório, até fechar as avaliações)"
                      }
                    >
                      <Crown className="size-4 text-tier-ouro" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {adicionados.length > 0 && (
          <section>
            <h2 className="mb-1 text-sm font-bold text-foreground">
              Adicionados pelo organizador ({adicionados.length})
            </h2>
            <p className="mb-2 text-xs text-muted-foreground">
              Estão no elenco do dia sem ter confirmado pelo app.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {adicionados.map((j) => (
                <span
                  key={j.id}
                  className="rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-[var(--shadow-card)]"
                >
                  {j.nome}
                </span>
              ))}
            </div>
          </section>
        )}

        {(souOrganizador || (podeGerir && pelada.status === "agendada")) && (
          <div className="flex items-center justify-center gap-6">
            {podeGerir && pelada.status === "agendada" && (
              <Link
                to="/pelada/$id/editar"
                params={{ id }}
                className="flex items-center gap-1.5 py-2 text-xs font-semibold text-primary"
              >
                <Pencil className="size-3.5" /> Editar pelada
              </Link>
            )}
            {souOrganizador && (
              <button
                type="button"
                onClick={() => setConfirmandoApagar(true)}
                className="flex items-center gap-1.5 py-2 text-xs font-semibold text-destructive"
              >
                <Trash2 className="size-3.5" /> Apagar pelada
              </button>
            )}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 mt-auto space-y-2 border-t border-border bg-card p-4">
        {finalizada && podeGerir && temPlacar && (
          <Button asChild variant="ghost" className="w-full">
            <Link to="/pelada/$id/placar" params={{ id }}>
              Corrigir placar
            </Link>
          </Button>
        )}
        {finalizada ? (
          dentroDaJanela && eu?.status === "aprovado" && aprovados.length > 1 && jaAvaliei ? (
            <>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs font-medium text-primary">
                <CheckCheck className="size-4" />
                Você já avaliou todo mundo
                {fimDaJanelaTexto ? ` · dá pra revisar até ${fimDaJanelaTexto}` : ""}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate({ to: "/pelada/$id/avaliar", params: { id } })}
              >
                Revisar minhas notas
              </Button>
            </>
          ) : dentroDaJanela && eu?.status === "aprovado" && aprovados.length > 1 ? (
            <Button
              className="w-full"
              onClick={() => navigate({ to: "/pelada/$id/avaliar", params: { id } })}
            >
              <Star className="mr-2 size-4" /> Avaliar jogadores
            </Button>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              {dentroDaJanela
                ? "Só quem jogou pode avaliar."
                : "A janela de 24h para avaliações já fechou."}
            </p>
          )
        ) : podeGerir ? (
          <>
            {timesMontados ? (
              <div className="flex gap-2">
                <Button asChild variant="outline" className="flex-[3]">
                  <Link to="/pelada/$id/times" params={{ id }}>
                    <Users className="mr-2 size-4" /> Jogadores e times
                  </Link>
                </Button>
                <Button asChild className="flex-[4]">
                  <Link to="/pelada/$id/placar" params={{ id }}>
                    <Play className="mr-2 size-4" />{" "}
                    {emAndamento ? "Voltar pro placar" : "Iniciar partida"}
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <Button asChild className="w-full">
                  <Link to="/pelada/$id/times" params={{ id }}>
                    <Users className="mr-2 size-4" /> Revisar e iniciar
                  </Link>
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Lá você adiciona jogadores, monta os times e inicia quando quiser.
                </p>
              </>
            )}
            {jaComecou ? (
              <Button variant="ghost" className="w-full" disabled={ocupado} onClick={finalizar}>
                <Flag className="mr-2 size-4" /> Finalizar sem placar
              </Button>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                Dá pra finalizar a partir do horário da pelada ({pelada.horario.slice(0, 5)}).
              </p>
            )}
          </>
        ) : eu?.status === "aprovado" ? (
          <Button variant="outline" className="w-full" disabled={ocupado} onClick={sair}>
            <LogOut className="mr-2 size-4" /> Sair da pelada
          </Button>
        ) : eu?.status === "pendente" ? (
          <Button variant="outline" className="w-full" disabled={ocupado} onClick={sair}>
            Cancelar solicitação
          </Button>
        ) : emAndamento ? (
          <Button disabled className="w-full">
            Pelada em andamento
          </Button>
        ) : lotado ? (
          <Button disabled className="w-full">
            Lotado
          </Button>
        ) : (
          <Button className="w-full" disabled={ocupado} onClick={entrar}>
            {pelada.tipo === "aberta" ? "Entrar na pelada" : "Solicitar entrada"}
          </Button>
        )}
      </div>

      {confirmandoApagar && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55"
          onClick={(e) => {
            if (e.target === e.currentTarget && !ocupado) setConfirmandoApagar(false);
          }}
        >
          <div
            role="dialog"
            aria-label="Apagar pelada"
            className="w-full max-w-[480px] space-y-3 rounded-t-3xl bg-card p-4 pb-6"
          >
            <h2 className="text-lg font-extrabold text-foreground">Apagar essa pelada?</h2>
            <p className="text-sm text-muted-foreground">
              Isso não tem volta. Some a pelada, a lista de confirmados e o link de convite.
              {temPlacar &&
                " O placar e as avaliações dela também: gols e vitórias desse dia saem do ranking da turma."}
            </p>
            <p className="text-xs text-muted-foreground">
              Se for uma pelada recorrente, só esta data é apagada.
            </p>
            <Button variant="destructive" className="w-full" disabled={ocupado} onClick={apagar}>
              {ocupado ? "Apagando…" : "Apagar pelada"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={ocupado}
              onClick={() => setConfirmandoApagar(false)}
            >
              Manter
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ nome, foto }: { nome: string; foto: string | null }) {
  const url = useAvatarUrl(foto);
  if (url) {
    return <img src={url} alt="" className="size-9 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
      {iniciais(nome)}
    </span>
  );
}
