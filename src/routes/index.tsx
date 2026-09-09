import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { GoatingLogo } from "@/components/goating/logo";
import { BottomNav } from "@/components/goating/bottom-nav";
import { MatchCard, type PeladaFeed } from "@/components/goating/match-card";
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
  local: string;
  cidade: string;
  quantidade_vagas: number;
  tipo: string;
  organizador_id: string;
};

function Feed() {
  const { userId, carregando } = useSession();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [entrando, setEntrando] = useState<string | null>(null);

  const feed = useQuery({
    queryKey: ["feed", userId],
    enabled: !!userId,
    queryFn: async (): Promise<PeladaFeed[]> => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: peladas, error } = await supabase
        .from("matches")
        .select(
          "id, titulo, data, horario, local, cidade, quantidade_vagas, tipo, organizador_id",
        )
        .eq("status", "agendada")
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
          .select("id, nome_exibicao, overall, peladas_jogadas")
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
                overall: Number(org.overall),
                peladas_jogadas: org.peladas_jogadas,
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

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return feed.data ?? [];
    return (feed.data ?? []).filter((p) =>
      [p.titulo, p.cidade, p.local].some((c) => c.toLowerCase().includes(termo)),
    );
  }, [feed.data, busca]);

  async function entrar(pelada: PeladaFeed) {
    if (!userId) return;
    setEntrando(pelada.id);
    const { error } = await supabase.from("match_participants").insert({
      match_id: pelada.id,
      user_id: userId,
      status: pelada.tipo === "aberta" ? "aprovado" : "pendente",
    });
    setEntrando(null);
    if (error) {
      toast.error("Não deu pra entrar nessa pelada. Ela pode ter lotado.");
      return;
    }
    toast.success(
      pelada.tipo === "aberta" ? "Você está dentro!" : "Solicitação enviada ao organizador.",
    );
    await queryClient.invalidateQueries({ queryKey: ["feed"] });
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-primary px-4 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            to="/perfil"
            className="rounded-full bg-mint/15 px-3 py-1.5 text-xs font-semibold text-mint"
          >
            Meu perfil
          </Link>
        </div>
        <div className="relative mt-4">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cidade, quadra ou pelada"
            className="h-11 rounded-xl border-0 bg-card pl-9 text-sm"
          />
        </div>
      </header>

      <main className="flex-1 space-y-3 px-4 py-4">
        {carregando || feed.isLoading ? (
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
        ) : lista.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-base font-semibold text-foreground">Nenhuma pelada por aqui ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Seja o primeiro a organizar e chame a galera pelo link.
            </p>
            <Button asChild className="mt-4 bg-mint text-mint-foreground hover:bg-mint/90">
              <Link to="/criar">Criar pelada</Link>
            </Button>
          </div>
        ) : (
          lista.map((p) => (
            <MatchCard
              key={p.id}
              pelada={p}
              onEntrar={entrar}
              carregando={entrando === p.id}
            />
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}
