import { useState } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Crown,
  Flag,
  Lock,
  LogOut,
  MapPin,
  Share2,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { tierDoJogador } from "@/lib/tiers";

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
    <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
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
  overall: number;
  peladas: number;
  foto: string | null;
};

function iniciais(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function dataLonga(data: string, horario: string) {
  const d = new Date(`${data}T${horario}`);
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }) + ` · ${horario.slice(0, 5)}`;
}

function DetalhePelada() {
  const { id } = useParams({ from: "/pelada/$id" });
  const { userId, carregando } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ocupado, setOcupado] = useState(false);

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

      const [{ data: parts }, { data: convite }] = await Promise.all([
        supabase.from("match_participants").select("id, user_id, status").eq("match_id", id),
        supabase.from("match_invite_links").select("token").eq("match_id", id).eq("ativo", true).maybeSingle(),
      ]);

      const ids = [...new Set([...(parts ?? []).map((p) => p.user_id), pelada.organizador_id])];
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nome_exibicao, overall, peladas_jogadas, foto_url")
        .in("id", ids);

      const lista: Participante[] = (parts ?? []).map((p) => {
        const perfil = (perfis ?? []).find((x) => x.id === p.user_id);
        return {
          id: p.id,
          user_id: p.user_id,
          status: p.status,
          nome: perfil?.nome_exibicao ?? "Jogador",
          overall: Number(perfil?.overall ?? 0),
          peladas: perfil?.peladas_jogadas ?? 0,
          foto: perfil?.foto_url ?? null,
        };
      });

      return {
        pelada,
        participantes: lista,
        organizador: (perfis ?? []).find((x) => x.id === pelada.organizador_id) ?? null,
        token: convite?.token ?? null,
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
      <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">Entre na sua conta para ver essa pelada.</p>
        <Button asChild>
          <Link to="/auth">Entrar no Goating</Link>
        </Button>
      </div>
    );
  }

  if (!consulta.data) return <Aviso texto="Essa pelada não existe mais." />;

  const { pelada, participantes, organizador, token } = consulta.data;
  const souOrganizador = pelada.organizador_id === userId;
  const aprovados = participantes.filter((p) => p.status === "aprovado");
  const pendentes = participantes.filter((p) => p.status === "pendente");
  const eu = participantes.find((p) => p.user_id === userId);
  const lotado = aprovados.length >= pelada.quantidade_vagas;
  const finalizada = pelada.status === "finalizada";
  const dentroDaJanela =
    finalizada &&
    !!pelada.finalizada_em &&
    Date.now() - new Date(pelada.finalizada_em).getTime() < 24 * 60 * 60 * 1000;
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

  async function definirMvp(jogadorId: string) {
    setOcupado(true);
    const { error } = await supabase
      .from("matches")
      .update({ mvp_id: pelada.mvp_id === jogadorId ? null : jogadorId })
      .eq("id", id);
    setOcupado(false);
    if (error) {
      toast.error("Não deu pra marcar o craque da partida.");
      return;
    }
    await atualizar();
  }

  return (
    <div className="app-shell flex min-h-screen flex-col pb-28">
      <header className="bg-primary px-4 pt-4 pb-5">
        <div className="flex items-center gap-3">
          <Link to="/" aria-label="Voltar">
            <ArrowLeft className="size-5 text-primary-foreground" />
          </Link>
          <span className="text-xs font-semibold tracking-wide text-mint uppercase">
            {finalizada ? "Pelada finalizada" : pelada.tipo === "aberta" ? "Pelada aberta" : "Pelada fechada"}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-primary-foreground">{pelada.titulo}</h1>
        <p className="mt-1 text-sm text-mint">por {organizador?.nome_exibicao ?? "organizador"}</p>
      </header>

      <div className="space-y-4 p-4">
        <div className="divide-y divide-border rounded-2xl bg-card shadow-[var(--shadow-card)]">
          <p className="flex items-center gap-2 px-4 py-3 text-sm text-foreground">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span className="capitalize">{dataLonga(pelada.data, pelada.horario)}</span>
          </p>
          <p className="flex items-center gap-2 px-4 py-3 text-sm text-foreground">
            <MapPin className="size-4 text-muted-foreground" />
            {pelada.local} · {pelada.cidade}
          </p>
          <p className="flex items-center gap-2 px-4 py-3 text-sm text-foreground">
            {pelada.tipo === "aberta" ? (
              <Check className="size-4 text-muted-foreground" />
            ) : (
              <Lock className="size-4 text-muted-foreground" />
            )}
            {aprovados.length}/{pelada.quantidade_vagas} confirmados
          </p>
        </div>

        {pelada.descricao && (
          <p className="rounded-2xl bg-secondary/60 p-4 text-sm text-foreground">{pelada.descricao}</p>
        )}

        {linkConvite && (souOrganizador || eu?.status === "aprovado") && (
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

        {souOrganizador && pendentes.length > 0 && (
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
            Confirmados ({aprovados.length})
          </h2>
          <div className="space-y-2">
            {aprovados.length === 0 && (
              <p className="text-sm text-muted-foreground">Ninguém confirmado ainda.</p>
            )}
            {aprovados.map((p) => {
              const tier = tierDoJogador(p.overall, p.peladas);
              const ehMvp = pelada.mvp_id === p.user_id;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]"
                >
                  <Avatar nome={p.nome} foto={p.foto} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {p.nome}
                      {p.user_id === pelada.organizador_id && (
                        <span className="ml-2 text-[10px] font-bold text-muted-foreground">ORG</span>
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
                  {finalizada && souOrganizador ? (
                    <button
                      aria-label={`Marcar ${p.nome} como craque da partida`}
                      disabled={ocupado}
                      onClick={() => definirMvp(p.user_id)}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg",
                        ehMvp ? "bg-tier-ouro/20 text-tier-ouro" : "bg-secondary text-muted-foreground",
                      )}
                    >
                      <Crown className="size-4" />
                    </button>
                  ) : (
                    ehMvp && <Crown className="size-4 text-tier-ouro" />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 space-y-2 border-t border-border bg-card p-4">
        {finalizada ? (
          dentroDaJanela && eu?.status === "aprovado" && aprovados.length > 1 ? (
            <Button
              className="w-full bg-mint font-semibold text-mint-foreground hover:bg-mint/90"
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
        ) : souOrganizador ? (
          <Button className="w-full" disabled={ocupado} onClick={finalizar}>
            <Flag className="mr-2 size-4" /> Finalizar pelada
          </Button>
        ) : eu?.status === "aprovado" ? (
          <Button variant="outline" className="w-full" disabled={ocupado} onClick={sair}>
            <LogOut className="mr-2 size-4" /> Sair da pelada
          </Button>
        ) : eu?.status === "pendente" ? (
          <Button variant="outline" className="w-full" disabled={ocupado} onClick={sair}>
            Cancelar solicitação
          </Button>
        ) : lotado ? (
          <Button disabled className="w-full">
            Lotado
          </Button>
        ) : (
          <Button
            className="w-full bg-mint font-semibold text-mint-foreground hover:bg-mint/90"
            disabled={ocupado}
            onClick={entrar}
          >
            {pelada.tipo === "aberta" ? "Entrar na pelada" : "Solicitar entrada"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Avatar({ nome, foto }: { nome: string; foto: string | null }) {
  if (foto) {
    return <img src={foto} alt={nome} className="size-9 rounded-full object-cover" />;
  }
  return (
    <span className="flex size-9 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
      {iniciais(nome)}
    </span>
  );
}
