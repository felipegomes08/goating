import { useEffect } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePerfil } from "@/hooks/use-session";
import { BottomNav } from "@/components/goating/bottom-nav";
import { JogadorItem, type JogadorResumo } from "@/components/goating/jogador-item";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MIN_AVALIACOES, avaliacoesFaltando } from "@/lib/tiers";

type Aba = "cidade" | "seguindo" | "geral";

export const Route = createFileRoute("/ranking")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { aba: Aba } => ({
    aba:
      search["aba"] === "seguindo" ? "seguindo" : search["aba"] === "geral" ? "geral" : "cidade",
  }),
  head: () => ({
    meta: [
      { title: "Ranking · Goating" },
      {
        name: "description",
        content: "Veja o ranking dos jogadores por overall na sua cidade, entre quem você segue ou geral.",
      },
      { property: "og:title", content: "Ranking Goating" },
      { property: "og:description", content: "Quem manda no futebol amador da sua cidade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Ranking,
});

const CAMPOS =
  "id, nome_exibicao, cidade, foto_url, overall, peladas_jogadas, xp, tier_reconhecido, avaliacoes_recebidas";

function Ranking() {
  const navigate = useNavigate();
  const { aba } = useSearch({ from: "/ranking" });
  const { userId, carregando } = useSession();
  const { data: perfil } = usePerfil(userId);

  useEffect(() => {
    if (!carregando && !userId) navigate({ to: "/auth", replace: true });
  }, [carregando, userId, navigate]);

  const cidade = perfil?.cidade ?? null;

  const lista = useQuery({
    queryKey: ["ranking", aba, cidade, userId],
    enabled: !!userId,
    queryFn: async (): Promise<JogadorResumo[]> => {
      if (aba === "seguindo") {
        const { data: vinculos, error } = await supabase
          .from("followers")
          .select("seguido_id")
          .eq("seguidor_id", userId!);
        if (error) throw error;
        const ids = (vinculos ?? []).map((v) => v.seguido_id);
        if (ids.length === 0) return [];
        const { data, error: erroPerfis } = await supabase
          .from("profiles")
          .select(CAMPOS)
          .in("id", ids)
          .gte("avaliacoes_recebidas", MIN_AVALIACOES)
          .order("overall", { ascending: false })
          .order("xp", { ascending: false })
          .limit(100);
        if (erroPerfis) throw erroPerfis;
        return (data ?? []) as JogadorResumo[];
      }

      let q = supabase
        .from("profiles")
        .select(CAMPOS)
        .gte("avaliacoes_recebidas", MIN_AVALIACOES);
      if (aba === "cidade" && cidade) q = q.eq("cidade", cidade);
      const { data, error } = await q
        .order("overall", { ascending: false })
        .order("xp", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as JogadorResumo[];
    },
  });

  const minhaPosicao = (lista.data ?? []).findIndex((j) => j.id === userId) + 1;
  const euApareco = minhaPosicao > 0;
  const liberado = perfil ? perfil.avaliacoes_recebidas >= MIN_AVALIACOES : false;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      <header className="bg-primary px-4 pt-6 pb-6">
        <h1 className="text-lg font-bold text-primary-foreground">Ranking</h1>

        <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-primary-foreground/10 p-1">
          {(
            [
              ["cidade", cidade ?? "Cidade"],
              ["seguindo", "Seguindo"],
              ["geral", "Geral"],
            ] as const
          ).map(([a, rotulo]) => (
            <Link
              key={a}
              to="/ranking"
              search={{ aba: a }}
              replace
              className={
                "truncate rounded-lg py-2 text-center text-xs font-semibold transition-colors " +
                (aba === a ? "bg-mint text-mint-foreground" : "text-mint")
              }
            >
              {rotulo}
            </Link>
          ))}
        </div>
      </header>

      <main className="flex-1 space-y-2 px-4 py-4">
        {!liberado && aba !== "seguindo" && (
          <p className="rounded-2xl bg-mint-soft p-3 text-xs font-medium text-primary">
            Faltam {avaliacoesFaltando(perfil?.avaliacoes_recebidas ?? 0)} avaliações pós-pelada
            pra você aparecer no ranking.
          </p>
        )}
        {liberado && !euApareco && aba === "cidade" && !cidade && (
          <p className="rounded-2xl bg-mint-soft p-3 text-xs font-medium text-primary">
            Complete sua cidade no perfil pra ver seu ranking local.
          </p>
        )}

        {lista.isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </>
        ) : (lista.data ?? []).length === 0 ? (
          <div className="space-y-3 pt-10 text-center">
            <p className="text-sm text-muted-foreground">
              {aba === "seguindo"
                ? "Ninguém que você segue tem ranking ainda."
                : "Ainda não tem ninguém no ranking por aqui."}
            </p>
            {aba === "seguindo" && (
              <Button asChild>
                <Link to="/buscar">Buscar jogadores pra seguir</Link>
              </Button>
            )}
          </div>
        ) : (
          (lista.data ?? []).map((j, i) => (
            <div
              key={j.id}
              className={
                j.id === userId ? "rounded-2xl ring-2 ring-mint ring-offset-2 ring-offset-background" : ""
              }
            >
              <JogadorItem jogador={j} posicao={i + 1} />
            </div>
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}
