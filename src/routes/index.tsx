import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePerfil } from "@/hooks/use-session";
import { GoatingLogo } from "@/components/goating/logo";
import { BottomNav } from "@/components/goating/bottom-nav";
import { MatchCard, estaPendenteAvaliacao, type PeladaFeed } from "@/components/goating/match-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Goating · Peladas de futebol na sua cidade" },
      {
        name: "description",
        content:
          "Encontre peladas perto de você, entre em campo e evolua sua cartinha de jogador a cada avaliação.",
      },
      { property: "og:title", content: "Goating · Peladas na sua cidade" },
      {
        property: "og:description",
        content: "A rede social do futebol amador: organize peladas, jogue e suba de tier.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Feed,
});

type LinhaPelada = {
  id: string;
  titulo: string;
  data: string;
  horario: string;
  horario_fim: string | null;
  local: string;
  cidade: string;
  quantidade_vagas: number;
  tipo: string;
  organizador_id: string;
};

type LinhaPeladaFinalizada = LinhaPelada & {
  status: string;
  finalizada_em: string | null;
};

function Feed() {
  const { userId, carregando } = useSession();
  const { data: perfil, isLoading: carregandoPerfil } = usePerfil(userId);
  const [busca, setBusca] = useState("");

  const cidade = perfil?.cidade ?? null;

  const feed = useQuery({
    queryKey: ["feed", userId, cidade],
    enabled: !!userId && !!cidade,
    queryFn: async (): Promise<PeladaFeed[]> => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: peladas, error } = await supabase
        .from("matches")
        .select(
          "id, titulo, data, horario, horario_fim, local, cidade, quantidade_vagas, tipo, organizador_id",
        )
        .eq("status", "agendada")
        .eq("cidade", cidade!)
        .gte("data", hoje)
        .order("data", { ascending: true })
        .order("horario", { ascending: true })
        .limit(50);
      if (error) throw error;
      const linhas = (peladas ?? []) as LinhaPelada[];
      if (linhas.length === 0) return [];

      const ids = linhas.map((p) => p.id);
      const organizadores = [...new Set(linhas.map((p) => p.organizador_id))];

      const [{ data: participantes }, { data: perfis }] = await Promise.all([
        supabase.from("match_participants").select("match_id, user_id, status").in("match_id", ids),
        supabase
          .from("profiles")
          .select("id, nome_exibicao, overall, tier_reconhecido")
          .in("id", organizadores),
      ]);

      return linhas.map((p) => {
        const doJogo = (participantes ?? []).filter((x) => x.match_id === p.id);
        const meu = doJogo.find((x) => x.user_id === userId);
        const org = (perfis ?? []).find((x) => x.id === p.organizador_id);
        return {
          ...p,
          confirmados: doJogo.filter((x) => x.status === "aprovado").length,
          organizador: org
            ? {
                nome_exibicao: org.nome_exibicao,
                overall: org.overall,
                tier_reconhecido: org.tier_reconhecido,
              }
            : null,
          minhaSituacao:
            meu?.status === "aprovado"
              ? "aprovado"
              : meu?.status === "pendente"
                ? "pendente"
                : "nenhuma",
        } satisfies PeladaFeed;
      });
    },
  });

  /** Peladas minhas (organizo ou joguei) que já acabaram e ainda estão na janela de 24h de avaliação. */
  const pendentesAvaliacao = useQuery({
    queryKey: ["feed-pendentes-avaliacao", userId],
    enabled: !!userId,
    queryFn: async (): Promise<PeladaFeed[]> => {
      const { data: vinculos, error: erroVinculos } = await supabase
        .from("match_participants")
        .select("match_id")
        .eq("user_id", userId!)
        .eq("status", "aprovado");
      if (erroVinculos) throw erroVinculos;
      const idsParticipante = (vinculos ?? []).map((v) => v.match_id);

      const filtro =
        idsParticipante.length > 0
          ? `organizador_id.eq.${userId},id.in.(${idsParticipante.join(",")})`
          : `organizador_id.eq.${userId}`;

      const { data: peladas, error } = await supabase
        .from("matches")
        .select(
          "id, titulo, data, horario, horario_fim, local, cidade, quantidade_vagas, tipo, organizador_id, status, finalizada_em",
        )
        .or(filtro)
        .eq("status", "finalizada")
        .order("finalizada_em", { ascending: false });
      if (error) throw error;
      const linhas = ((peladas ?? []) as LinhaPeladaFinalizada[]).filter((p) =>
        estaPendenteAvaliacao(p),
      );
      if (linhas.length === 0) return [];

      const ids = linhas.map((p) => p.id);
      const organizadores = [...new Set(linhas.map((p) => p.organizador_id))];

      const [{ data: participantes }, { data: perfis }] = await Promise.all([
        supabase.from("match_participants").select("match_id, user_id, status").in("match_id", ids),
        supabase
          .from("profiles")
          .select("id, nome_exibicao, overall, tier_reconhecido")
          .in("id", organizadores),
      ]);

      return linhas.map((p) => {
        const doJogo = (participantes ?? []).filter((x) => x.match_id === p.id);
        const meu = doJogo.find((x) => x.user_id === userId);
        const org = (perfis ?? []).find((x) => x.id === p.organizador_id);
        return {
          ...p,
          confirmados: doJogo.filter((x) => x.status === "aprovado").length,
          organizador: org
            ? {
                nome_exibicao: org.nome_exibicao,
                overall: org.overall,
                tier_reconhecido: org.tier_reconhecido,
              }
            : null,
          mvp: null,
          minhaSituacao:
            meu?.status === "aprovado"
              ? "aprovado"
              : meu?.status === "pendente"
                ? "pendente"
                : "nenhuma",
        } satisfies PeladaFeed;
      });
    },
  });

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return feed.data ?? [];
    return (feed.data ?? []).filter((p) =>
      [p.titulo, p.cidade, p.local].some((c) => c.toLowerCase().includes(termo)),
    );
  }, [feed.data, busca]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-primary px-4 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <GoatingLogo withWordmark iconTone="light" wordmarkTone="dark" />
          <Link
            to="/perfil"
            className="rounded-full bg-mint/15 px-3 py-1.5 text-xs font-semibold text-mint"
          >
            Meu perfil
          </Link>
        </div>
        {cidade && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-mint">
            <MapPin className="size-3.5" />
            {cidade}
          </p>
        )}
        <div className="relative mt-3">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por quadra ou pelada"
            className="h-11 rounded-xl border-0 bg-card pl-9 text-sm"
          />
        </div>
      </header>

      <main className="flex-1 space-y-3 px-4 py-4">
        {!!pendentesAvaliacao.data?.length && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
              Pendente de avaliação
            </h2>
            {pendentesAvaliacao.data.map((p) => (
              <MatchCard key={p.id} pelada={p} voltarPara="feed" />
            ))}
          </div>
        )}

        {carregando || carregandoPerfil || (!!cidade && feed.isLoading) ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)
        ) : !userId ? (
          <div className="mt-16 text-center">
            <p className="text-sm text-muted-foreground">
              Entre na sua conta para ver as peladas da sua cidade.
            </p>
            <Button asChild className="mt-4">
              <Link to="/auth">Entrar no Goating</Link>
            </Button>
          </div>
        ) : !cidade ? (
          <div className="mt-16 space-y-3 text-center">
            <p className="text-base font-semibold text-foreground">Falta só um passo</p>
            <p className="text-sm text-muted-foreground">
              Complete seu cadastro para ver as peladas perto de você.
            </p>
            <Button asChild className="mt-2 bg-mint text-mint-foreground hover:bg-mint/90">
              <Link to="/perfil">Completar cadastro</Link>
            </Button>
          </div>
        ) : lista.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-base font-semibold text-foreground">
              Nenhuma pelada em {cidade} ainda
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Seja o primeiro a organizar e chame a galera pelo link.
            </p>
            <Button asChild className="mt-4 bg-mint text-mint-foreground hover:bg-mint/90">
              <Link to="/criar">Criar pelada em {cidade}</Link>
            </Button>
          </div>
        ) : (
          lista.map((p) => <MatchCard key={p.id} pelada={p} />)
        )}
      </main>

      <BottomNav />
    </div>
  );
}
