import { useEffect } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { BottomNav } from "@/components/goating/bottom-nav";
import { JogadorItem, type JogadorResumo } from "@/components/goating/jogador-item";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Aba = "seguindo" | "seguidores";

export const Route = createFileRoute("/rede")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { aba: Aba } => ({
    aba: search['aba'] === "seguidores" ? "seguidores" : "seguindo",
  }),
  head: () => ({
    meta: [
      { title: "Minha rede · Goating" },
      {
        name: "description",
        content:
          "Ranking dos jogadores que você segue no Goating, do maior overall para o menor, e quem segue você.",
      },
      { property: "og:title", content: "Minha rede no Goating" },
      {
        property: "og:description",
        content: "Veja o rank dos jogadores que você segue e quem está te seguindo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rede,
});

const CAMPOS =
  "id, nome_exibicao, cidade, foto_url, overall, peladas_jogadas, avaliacoes_recebidas";

function Rede() {
  const navigate = useNavigate();
  const { aba } = useSearch({ from: "/rede" });
  const { userId, carregando } = useSession();

  useEffect(() => {
    if (!carregando && !userId) navigate({ to: "/auth", replace: true });
  }, [carregando, userId, navigate]);

  const lista = useQuery({
    queryKey: ["rede", userId, aba],
    enabled: !!userId,
    queryFn: async () => {
      const colunaFiltro = aba === "seguindo" ? "seguidor_id" : "seguido_id";
      const colunaAlvo = aba === "seguindo" ? "seguido_id" : "seguidor_id";

      const { data: vinculos, error } = await supabase
        .from("followers")
        .select("seguidor_id, seguido_id")
        .eq(colunaFiltro, userId!);
      if (error) throw error;

      const ids = (vinculos ?? []).map((v) => v[colunaAlvo] as string);
      if (ids.length === 0) return [] as JogadorResumo[];

      const { data, error: erroPerfis } = await supabase
        .from("profiles")
        .select(CAMPOS)
        .in("id", ids)
        .order("overall", { ascending: false });
      if (erroPerfis) throw erroPerfis;
      return (data ?? []) as JogadorResumo[];
    },
  });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      <header className="bg-primary px-4 pt-6 pb-6">
        <div className="flex items-center justify-between">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-mint hover:bg-mint/10 hover:text-mint"
          >
            <Link to="/perfil">
              <ArrowLeft className="size-4" /> Perfil
            </Link>
          </Button>
          <h1 className="text-lg font-bold text-primary-foreground">Minha rede</h1>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-primary-foreground/10 p-1">
          {(["seguindo", "seguidores"] as const).map((a) => (
            <Link
              key={a}
              to="/rede"
              search={{ aba: a }}
              replace
              className={
                "rounded-lg py-2 text-center text-sm font-semibold transition-colors " +
                (aba === a ? "bg-mint text-mint-foreground" : "text-mint")
              }
            >
              {a === "seguindo" ? "Seguindo" : "Seguidores"}
            </Link>
          ))}
        </div>
      </header>

      <main className="flex-1 space-y-2 px-4 py-4">
        {aba === "seguindo" && (
          <p className="pb-1 text-xs text-muted-foreground">
            Rank dos jogadores que você segue, do maior overall para o menor.
          </p>
        )}

        {lista.isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </>
        ) : (lista.data ?? []).length === 0 ? (
          <div className="space-y-3 pt-10 text-center">
            <p className="text-sm text-muted-foreground">
              {aba === "seguindo"
                ? "Você ainda não segue ninguém."
                : "Ninguém está te seguindo ainda."}
            </p>
            <Button asChild>
              <Link to="/buscar">Buscar jogadores</Link>
            </Button>
          </div>
        ) : (
          (lista.data ?? []).map((j) => <JogadorItem key={j.id} jogador={j} />)
        )}
      </main>

      <BottomNav />
    </div>
  );
}
