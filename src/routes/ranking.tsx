import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePerfil } from "@/hooks/use-session";
import { BottomNav } from "@/components/goating/bottom-nav";
import { JogadorItem, type JogadorResumo } from "@/components/goating/jogador-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        content: "Veja o ranking dos jogadores por overall na sua cidade, entre quem você segue ou geral, ou busque por nome.",
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
  const queryClient = useQueryClient();
  const { aba } = useSearch({ from: "/ranking" });
  const { userId, carregando } = useSession();
  const { data: perfil } = usePerfil(userId);
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState("");
  const [ocupados, setOcupados] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!carregando && !userId) navigate({ to: "/auth", replace: true });
  }, [carregando, userId, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setBusca(termo.trim()), 300);
    return () => clearTimeout(t);
  }, [termo]);

  const cidade = perfil?.cidade ?? null;
  const buscando = !!busca;

  const meusSeguidos = useQuery({
    queryKey: ["meus-seguidos", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followers")
        .select("seguido_id")
        .eq("seguidor_id", userId!);
      if (error) throw error;
      return new Set((data ?? []).map((d) => d.seguido_id));
    },
  });

  const lista = useQuery({
    queryKey: ["ranking", aba, cidade, userId, busca],
    enabled: !!userId,
    queryFn: async (): Promise<JogadorResumo[]> => {
      if (busca) {
        const { data, error } = await supabase
          .from("profiles")
          .select(CAMPOS)
          .neq("id", userId!)
          .ilike("nome_exibicao", `%${busca}%`)
          .gte("avaliacoes_recebidas", MIN_AVALIACOES)
          .order("overall", { ascending: false })
          .limit(30);
        if (error) throw error;
        return (data ?? []) as JogadorResumo[];
      }

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

  async function alternarSeguir(alvoId: string, jaSegue: boolean) {
    if (!userId) return;
    setOcupados((s) => new Set(s).add(alvoId));
    const { error } = jaSegue
      ? await supabase.from("followers").delete().eq("seguidor_id", userId).eq("seguido_id", alvoId)
      : await supabase.from("followers").insert({ seguidor_id: userId, seguido_id: alvoId });
    setOcupados((s) => {
      const novo = new Set(s);
      novo.delete(alvoId);
      return novo;
    });
    if (error) {
      toast.error(jaSegue ? "Não deu pra deixar de seguir agora." : "Não deu pra seguir agora.");
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["meus-seguidos", userId] }),
      queryClient.invalidateQueries({ queryKey: ["segue", userId, alvoId] }),
      queryClient.invalidateQueries({ queryKey: ["rede-contagem", alvoId] }),
      queryClient.invalidateQueries({ queryKey: ["seguidores", userId] }),
      queryClient.invalidateQueries({ queryKey: ["rede", userId] }),
      queryClient.invalidateQueries({ queryKey: ["ranking"] }),
    ]);
  }

  const minhaPosicao = (lista.data ?? []).findIndex((j) => j.id === userId) + 1;
  const euApareco = minhaPosicao > 0;
  const liberado = perfil ? perfil.avaliacoes_recebidas >= MIN_AVALIACOES : false;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      <header className="bg-primary px-4 pt-6 pb-6">
        <h1 className="text-lg font-bold text-primary-foreground">Ranking</h1>

        <div className="relative mt-4">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar jogador pelo nome"
            className="bg-card pl-9"
            aria-label="Buscar por nome de exibição"
          />
        </div>

        {!buscando && (
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-primary-foreground/10 p-1">
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
        )}
      </header>

      <main className="flex-1 space-y-2 px-4 py-4">
        {!buscando && !liberado && aba !== "seguindo" && (
          <p className="rounded-2xl bg-mint-soft p-3 text-xs font-medium text-primary">
            Faltam {avaliacoesFaltando(perfil?.avaliacoes_recebidas ?? 0)} avaliações pós-pelada
            pra você aparecer no ranking.
          </p>
        )}
        {!buscando && liberado && !euApareco && aba === "cidade" && !cidade && (
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
              {buscando
                ? "Nenhum jogador encontrado com esse nome."
                : aba === "seguindo"
                  ? "Ninguém que você segue tem ranking ainda."
                  : "Ainda não tem ninguém no ranking por aqui."}
            </p>
            {!buscando && aba === "seguindo" && (
              <p className="text-xs text-muted-foreground">
                Busca pelo nome de um jogador aí em cima pra começar a seguir.
              </p>
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
              <JogadorItem
                jogador={j}
                posicao={buscando ? undefined : i + 1}
                seguindo={buscando ? (meusSeguidos.data?.has(j.id) ?? false) : undefined}
                ocupado={ocupados.has(j.id)}
                onAlternarSeguir={
                  buscando ? () => alternarSeguir(j.id, meusSeguidos.data?.has(j.id) ?? false) : undefined
                }
              />
            </div>
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}
