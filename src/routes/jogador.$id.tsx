import { useEffect } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil, useSession } from "@/hooks/use-session";
import { useNumerosDoJogador } from "@/hooks/use-numeros-do-jogador";
import { useVoltar } from "@/hooks/use-voltar";
import { useAvatarUrl } from "@/hooks/use-avatar";
import { BottomNav } from "@/components/goating/bottom-nav";
import { PlayerCard } from "@/components/goating/player-card";
import { ComentariosDoJogador } from "@/components/goating/comentarios-do-jogador";
import { AtributosDoJogador } from "@/components/goating/atributos-do-jogador";
import { NumerosDaCarreira } from "@/components/goating/numeros-da-carreira";
import { CompararJogadores } from "@/components/goating/comparar-jogadores";
import { usePremium } from "@/hooks/use-premium";
import { SeloPremium } from "@/components/goating/selo-premium";
import { GaleriaDeMvps } from "@/components/goating/galeria-de-mvps";
import { ConquistasDoJogador } from "@/components/goating/conquistas";
import { capaDe } from "@/lib/capas";
import { molduraDe } from "@/lib/molduras";
import { ehPremium } from "@/lib/premium";
import { atributosZerados, carregarMedias } from "@/lib/atributos";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { overallLiberado, tierPorNome } from "@/lib/tiers";

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
  const numeros = useNumerosDoJogador(id);
  const navigate = useNavigate();
  const voltar = useVoltar(() => void navigate({ to: "/ranking", search: { aba: "cidade" } }));
  const queryClient = useQueryClient();
  const { userId, carregando } = useSession();
  const { data: meuPerfil } = usePerfil(userId);
  const { premium: eupremium } = usePremium();

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

  const posicao = perfil?.posicao_preferida ?? null;
  const medias = useQuery({
    queryKey: ["medias", id, posicao],
    enabled: !!userId && !!perfil,
    queryFn: () => carregarMedias(id, posicao),
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
      <div className="mx-auto min-h-dvh w-full max-w-[480px] space-y-4 bg-background p-4">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-sm text-muted-foreground">Não encontramos esse jogador.</p>
        <Button asChild>
          <Link to="/ranking" search={{ aba: "cidade" }}>
            Ver ranking
          </Link>
        </Button>
      </div>
    );
  }

  const liberado = overallLiberado(perfil.avaliacoes_recebidas);
  const overall = liberado ? Number(perfil.overall) : 0;
  const tier = liberado ? tierPorNome(perfil.tier_reconhecido) : null;
  const attrs = medias.data?.atributos ?? atributosZerados(posicao);
  // as notas de cada habilidade só aparecem quando o dono do perfil é Premium
  const notasOcultas = medias.data ? !medias.data.liberadas : !ehPremium(perfil);
  const segue = !!seguindoEste.data;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-background">
      <header
        className="bg-primary px-4 pt-6 pb-8"
        style={capaDe(perfil) ? { background: capaDe(perfil)!.fundo } : undefined}
      >
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={voltar}
            className="text-mint hover:bg-mint/10 hover:text-mint"
          >
            <ArrowLeft className="size-4" /> Voltar
          </Button>
          <h1 className="flex min-w-0 items-center gap-1.5 text-lg font-bold text-primary-foreground">
            <span className="truncate">{perfil.nome_exibicao}</span>
            {ehPremium(perfil) && <SeloPremium className="size-4" />}
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
            moldura={molduraDe(perfil)}
            notasOcultas={notasOcultas}
          />
        </div>

        {userId && userId !== perfil.id && (
          <CompararJogadores
            meuId={userId}
            premium={eupremium}
            nome={perfil.nome_exibicao}
            posicao={posicao}
            overall={Math.round(overall)}
            meuOverall={Math.round(Number(meuPerfil?.overall ?? 0))}
            atributos={attrs}
            ocultas={notasOcultas}
          />
        )}

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

        <section className="grid grid-cols-2 gap-2">
          {[
            ["Peladas", perfil.peladas_jogadas],
            ["XP", perfil.xp],
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

        {/* a carreira aparece quando o dono do perfil é Premium */}
        <NumerosDaCarreira
          numeros={numeros.data}
          liberado={ehPremium(perfil)}
          proprio={false}
          nome={perfil.nome_exibicao}
        />

        <section className="rounded-2xl bg-card p-4 text-sm shadow-[var(--shadow-card)]">
          {perfil.handle && <p className="font-bold text-primary">@{perfil.handle}</p>}
          <p className="mt-1 text-muted-foreground">
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

        {/* a galeria aparece pra visitantes só quando o dono é Premium */}
        <ConquistasDoJogador userId={perfil.id} proprio={false} premiumDono={ehPremium(perfil)} />

        {ehPremium(perfil) && <GaleriaDeMvps userId={perfil.id} total={perfil.vezes_mvp} premium />}

        <AtributosDoJogador
          atributos={attrs}
          ocultas={notasOcultas}
          proprio={false}
          nome={perfil.nome_exibicao}
        />

        <ComentariosDoJogador userId={id} proprio={false} />
      </main>

      <BottomNav />
    </div>
  );
}
