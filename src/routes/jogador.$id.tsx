import { useEffect } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useAvatarUrl } from "@/hooks/use-avatar";
import { BottomNav } from "@/components/goating/bottom-nav";
import { PlayerCard } from "@/components/goating/player-card";
import { RadarAttrs } from "@/components/goating/radar-attrs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { overallLiberado, paraEscalaCard, tierDoJogador } from "@/lib/tiers";

export const Route = createFileRoute("/jogador/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Perfil do jogador · Goating" },
      {
        name: "description",
        content:
          "Veja a cartinha, os atributos e as estatísticas de peladas deste jogador no Goating.",
      },
      { property: "og:title", content: "Perfil do jogador no Goating" },
      {
        property: "og:description",
        content: "Cartinha, overall, tier e histórico de peladas do jogador.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JogadorPublico,
});

function JogadorPublico() {
  const { id } = useParams({ from: "/jogador/$id" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId, carregando } = useSession();

  useEffect(() => {
    if (carregando) return;
    if (!userId) navigate({ to: "/auth", replace: true });
    else if (userId === id) navigate({ to: "/perfil", replace: true });
  }, [carregando, userId, id, navigate]);

  const perfilQuery = useQuery({
    queryKey: ["perfil", id],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const perfil = perfilQuery.data;
  const fotoUrl = useAvatarUrl(perfil?.foto_url);

  const medias = useQuery({
    queryKey: ["medias", id],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evaluations")
        .select("chute, drible, velocidade, toque, posicionamento, comportamento, pontualidade")
        .eq("avaliado_id", id);
      if (error) throw error;
      const linhas = data ?? [];
      const media = (chave: keyof (typeof linhas)[number]) => {
        const valores = linhas
          .map((l) => l[chave])
          .filter((v): v is number => v !== null && v !== undefined);
        if (valores.length === 0) return 0;
        return paraEscalaCard(valores.reduce((a, b) => a + Number(b), 0) / valores.length);
      };
      return {
        chute: media("chute"),
        drible: media("drible"),
        velocidade: media("velocidade"),
        toque: media("toque"),
        posicionamento: media("posicionamento"),
        comportamento: media("comportamento"),
        pontualidade: media("pontualidade"),
      };
    },
  });

  const rede = useQuery({
    queryKey: ["rede-contagem", id],
    enabled: !!userId,
    queryFn: async () => {
      const [a, b] = await Promise.all([
        supabase
          .from("followers")
          .select("id", { count: "exact", head: true })
          .eq("seguido_id", id),
        supabase
          .from("followers")
          .select("id", { count: "exact", head: true })
          .eq("seguidor_id", id),
      ]);
      return { seguidores: a.count ?? 0, seguindo: b.count ?? 0 };
    },
  });

  const seguindoEste = useQuery({
    queryKey: ["segue", userId, id],
    enabled: !!userId && userId !== id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followers")
        .select("id")
        .eq("seguidor_id", userId!)
        .eq("seguido_id", id)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });

  async function alternarSeguir() {
    if (!userId) return;
    const existente = seguindoEste.data;
    if (existente) {
      const { error } = await supabase.from("followers").delete().eq("id", existente);
      if (error) {
        toast.error("Não deu pra deixar de seguir agora.");
        return;
      }
      toast.success("Você deixou de seguir.");
    } else {
      const { error } = await supabase
        .from("followers")
        .insert({ seguidor_id: userId, seguido_id: id });
      if (error) {
        toast.error("Não deu pra seguir esse jogador agora.");
        return;
      }
      toast.success("Agora você segue esse jogador!");
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["segue", userId, id] }),
      queryClient.invalidateQueries({ queryKey: ["rede-contagem", id] }),
      queryClient.invalidateQueries({ queryKey: ["seguidores", userId] }),
      queryClient.invalidateQueries({ queryKey: ["rede", userId] }),
    ]);
  }

  if (carregando || perfilQuery.isLoading) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-[480px] space-y-4 bg-background p-4">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">Não encontramos esse jogador.</p>
        <Button asChild>
          <Link to="/buscar">Buscar jogadores</Link>
        </Button>
      </div>
    );
  }

  const liberado = overallLiberado(perfil.avaliacoes_recebidas);
  const overall = liberado ? Number(perfil.overall) : 0;
  const tier = liberado ? tierDoJogador(overall, perfil.peladas_jogadas) : null;
  const attrs = medias.data ?? {
    chute: 0,
    drible: 0,
    velocidade: 0,
    toque: 0,
    posicionamento: 0,
    comportamento: 0,
    pontualidade: 0,
  };
  const segue = !!seguindoEste.data;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      <header className="bg-primary px-4 pt-6 pb-8">
        <div className="flex items-center justify-between">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-mint hover:bg-mint/10 hover:text-mint"
          >
            <Link to="/buscar">
              <ArrowLeft className="size-4" /> Buscar
            </Link>
          </Button>
          <h1 className="truncate text-lg font-bold text-primary-foreground">
            {perfil.nome_exibicao}
          </h1>
        </div>

        <div className="mt-5">
          <PlayerCard
            nome={perfil.nome_exibicao}
            posicao={perfil.posicao_preferida}
            overall={overall}
            atributos={attrs}
            fotoUrl={fotoUrl}
            tier={tier}
            cardGeradoUrl={perfil.card_gerado_url}
            avaliacoesRecebidas={perfil.avaliacoes_recebidas}
          />
        </div>

        <Button
          onClick={alternarSeguir}
          disabled={seguindoEste.isLoading}
          className={
            segue
              ? "mx-auto mt-5 flex bg-mint/15 font-semibold text-mint hover:bg-mint/25"
              : "mx-auto mt-5 flex bg-mint font-semibold text-mint-foreground hover:bg-mint/90"
          }
        >
          {segue ? <UserMinus className="size-4" /> : <UserPlus className="size-4" />}
          {segue ? "Deixar de seguir" : "Seguir"}
        </Button>
      </header>

      <main className="flex-1 space-y-4 px-4 py-4">
        <section className="flex items-center justify-around rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{rede.data?.seguidores ?? 0}</span>{" "}
            seguidores
          </p>
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{rede.data?.seguindo ?? 0}</span> seguindo
          </p>
        </section>

        <section className="grid grid-cols-3 gap-2">
          {[
            ["Peladas", perfil.peladas_jogadas],
            ["MVPs", perfil.vezes_mvp],
            ["Avaliações", perfil.avaliacoes_recebidas],
          ].map(([label, valor]) => (
            <div
              key={String(label)}
              className="rounded-2xl bg-card p-3 text-center shadow-[var(--shadow-card)]"
            >
              <p className="text-xl font-extrabold text-foreground">{valor}</p>
              <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl bg-card p-4 text-sm shadow-[var(--shadow-card)]">
          <p className="text-muted-foreground">
            Cidade:{" "}
            <span className="font-semibold text-foreground">
              {perfil.cidade ?? "não informada"}
            </span>
          </p>
          <p className="mt-1 text-muted-foreground">
            Posição:{" "}
            <span className="font-semibold text-foreground">
              {perfil.posicao_preferida ?? "não informada"}
            </span>
          </p>
          {perfil.bio && <p className="mt-2 text-xs text-muted-foreground">{perfil.bio}</p>}
        </section>

        <section className="rounded-2xl bg-primary p-4">
          <h2 className="mb-2 text-sm font-bold text-primary-foreground">Atributos</h2>
          <RadarAttrs
            eixos={[
              { label: "Chute", valor: attrs.chute },
              { label: "Drible", valor: attrs.drible },
              { label: "Velocidade", valor: attrs.velocidade },
              { label: "Toque", valor: attrs.toque },
              { label: "Posição", valor: attrs.posicionamento },
              { label: "Postura", valor: attrs.comportamento },
              { label: "Pontual", valor: attrs.pontualidade },
            ]}
          />
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
