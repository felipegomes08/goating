import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { BottomNav } from "@/components/goating/bottom-nav";
import { JogadorItem, type JogadorResumo } from "@/components/goating/jogador-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/buscar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Buscar jogadores · Goating" },
      {
        name: "description",
        content: "Encontre jogadores de pelada pelo nome, veja a cartinha deles e comece a seguir.",
      },
      { property: "og:title", content: "Buscar jogadores no Goating" },
      {
        property: "og:description",
        content: "Procure jogadores da sua cidade e siga quem joga com você.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Buscar,
});

const CAMPOS =
  "id, nome_exibicao, cidade, foto_url, overall, peladas_jogadas, avaliacoes_recebidas";

function Buscar() {
  const navigate = useNavigate();
  const { userId, carregando } = useSession();
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!carregando && !userId) navigate({ to: "/auth", replace: true });
  }, [carregando, userId, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setBusca(termo.trim()), 300);
    return () => clearTimeout(t);
  }, [termo]);

  const resultados = useQuery({
    queryKey: ["buscar-jogadores", busca, userId],
    enabled: !!userId,
    queryFn: async () => {
      let q = supabase.from("profiles").select(CAMPOS).neq("id", userId!).limit(30);
      q = busca
        ? q.ilike("nome_exibicao", `%${busca}%`).order("overall", { ascending: false })
        : q.order("overall", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
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
          <h1 className="text-lg font-bold text-primary-foreground">Buscar jogadores</h1>
        </div>

        <div className="relative mt-4">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Nome do jogador"
            className="bg-card pl-9"
            aria-label="Buscar por nome de exibição"
          />
        </div>
      </header>

      <main className="flex-1 space-y-2 px-4 py-4">
        {resultados.isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </>
        ) : (resultados.data ?? []).length === 0 ? (
          <p className="pt-10 text-center text-sm text-muted-foreground">
            Nenhum jogador encontrado com esse nome.
          </p>
        ) : (
          (resultados.data ?? []).map((j) => <JogadorItem key={j.id} jogador={j} />)
        )}
      </main>

      <BottomNav />
    </div>
  );
}
