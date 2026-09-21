import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePerfil } from "@/hooks/use-session";
import { BottomNav } from "@/components/goating/bottom-nav";
import { JogadorItem, type JogadorResumo } from "@/components/goating/jogador-item";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/buscar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Comunidade · Goating" },
      {
        name: "description",
        content: "Ache jogadores da sua cidade, veja sugestões pra seguir e busque pelo nome.",
      },
      { property: "og:title", content: "Comunidade Goating" },
      {
        property: "og:description",
        content: "Sugestões de jogadores pra seguir e busca por nome.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Comunidade,
});

const CAMPOS =
  "id, nome_exibicao, cidade, foto_url, overall, peladas_jogadas, avaliacoes_recebidas";

function Comunidade() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const modoSugestoes = !busca;

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

  const resultados = useQuery({
    queryKey: ["comunidade", busca, cidade, userId, [...(meusSeguidos.data ?? [])].join(",")],
    enabled: !!userId && meusSeguidos.isSuccess,
    queryFn: async () => {
      if (busca) {
        const { data, error } = await supabase
          .from("profiles")
          .select(CAMPOS)
          .neq("id", userId!)
          .ilike("nome_exibicao", `%${busca}%`)
          .order("overall", { ascending: false })
          .limit(30);
        if (error) throw error;
        return (data ?? []) as JogadorResumo[];
      }

      let q = supabase.from("profiles").select(CAMPOS).neq("id", userId!);
      if (cidade) q = q.eq("cidade", cidade);
      const seguidos = [...(meusSeguidos.data ?? [])];
      if (seguidos.length > 0) q = q.not("id", "in", `(${seguidos.join(",")})`);
      const { data, error } = await q.order("overall", { ascending: false }).limit(20);
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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      <header className="bg-primary px-4 pt-6 pb-6">
        <h1 className="text-lg font-bold text-primary-foreground">Comunidade</h1>

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
      </header>

      <main className="flex-1 space-y-2 px-4 py-4">
        {modoSugestoes && (
          <p className="pb-1 text-xs text-muted-foreground">
            {cidade ? `Sugestões pra seguir em ${cidade}` : "Sugestões pra seguir"}
          </p>
        )}

        {resultados.isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </>
        ) : (resultados.data ?? []).length === 0 ? (
          <p className="pt-10 text-center text-sm text-muted-foreground">
            {modoSugestoes
              ? "Sem sugestões novas por aqui agora. Tenta buscar por nome."
              : "Nenhum jogador encontrado com esse nome."}
          </p>
        ) : (
          (resultados.data ?? []).map((j) => (
            <JogadorItem
              key={j.id}
              jogador={j}
              seguindo={meusSeguidos.data?.has(j.id) ?? false}
              ocupado={ocupados.has(j.id)}
              onAlternarSeguir={() => alternarSeguir(j.id, meusSeguidos.data?.has(j.id) ?? false)}
            />
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}
