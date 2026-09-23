import { useEffect } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { BottomNav } from "@/components/goating/bottom-nav";
import { MatchCard, estaPendenteAvaliacao, type PeladaFeed } from "@/components/goating/match-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Aba = "proximas" | "passadas";

export const Route = createFileRoute("/minhas-partidas")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { aba: Aba } => ({
    aba: search["aba"] === "passadas" ? "passadas" : "proximas",
  }),
  head: () => ({
    meta: [
      { title: "Minhas partidas · Goating" },
      {
        name: "description",
        content: "Peladas que você organiza ou está participando, próximas e já jogadas.",
      },
      { property: "og:title", content: "Minhas partidas · Goating" },
      {
        property: "og:description",
        content: "Acompanhe as peladas que você criou ou entrou.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MinhasPartidas,
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
  status: string;
  organizador_id: string;
  mvp_id: string | null;
  finalizada_em: string | null;
};

function MinhasPartidas() {
  const navigate = useNavigate();
  const { aba } = useSearch({ from: "/minhas-partidas" });
  const { userId, carregando } = useSession();

  useEffect(() => {
    if (!carregando && !userId) navigate({ to: "/auth", replace: true });
  }, [carregando, userId, navigate]);

  const minhas = useQuery({
    queryKey: ["minhas-partidas", userId],
    enabled: !!userId,
    queryFn: async (): Promise<PeladaFeed[]> => {
      const { data: vinculos, error: erroVinculos } = await supabase
        .from("match_participants")
        .select("match_id")
        .eq("user_id", userId!)
        .in("status", ["aprovado", "pendente"]);
      if (erroVinculos) throw erroVinculos;
      const idsParticipante = (vinculos ?? []).map((v) => v.match_id);

      const filtro =
        idsParticipante.length > 0
          ? `organizador_id.eq.${userId},id.in.(${idsParticipante.join(",")})`
          : `organizador_id.eq.${userId}`;

      const { data: peladas, error } = await supabase
        .from("matches")
        .select(
          "id, titulo, data, horario, horario_fim, local, cidade, quantidade_vagas, tipo, status, organizador_id, mvp_id, finalizada_em",
        )
        .or(filtro)
        .order("data", { ascending: true })
        .order("horario", { ascending: true });
      if (error) throw error;
      const linhas = (peladas ?? []) as LinhaPelada[];
      if (linhas.length === 0) return [];

      const ids = linhas.map((p) => p.id);
      const pessoas = [
        ...new Set([
          ...linhas.map((p) => p.organizador_id),
          ...linhas.map((p) => p.mvp_id).filter((id): id is string => !!id),
        ]),
      ];

      const [{ data: participantes }, { data: perfis }] = await Promise.all([
        supabase.from("match_participants").select("match_id, user_id, status").in("match_id", ids),
        supabase
          .from("profiles")
          .select("id, nome_exibicao, overall, tier_reconhecido")
          .in("id", pessoas),
      ]);

      return linhas.map((p) => {
        const doJogo = (participantes ?? []).filter((x) => x.match_id === p.id);
        const meu = doJogo.find((x) => x.user_id === userId);
        const org = (perfis ?? []).find((x) => x.id === p.organizador_id);
        const mvp = p.mvp_id ? (perfis ?? []).find((x) => x.id === p.mvp_id) : null;
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
          mvp: mvp ? { nome_exibicao: mvp.nome_exibicao } : null,
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

  const emAberto = (minhas.data ?? []).filter((p) => p.status !== "finalizada");
  const pendentesAvaliacao = (minhas.data ?? [])
    .filter((p) => estaPendenteAvaliacao(p))
    .sort((a, b) => (b.finalizada_em ?? "").localeCompare(a.finalizada_em ?? ""));
  const proximas = [
    ...pendentesAvaliacao,
    ...emAberto.sort((a, b) => `${a.data}${a.horario}`.localeCompare(`${b.data}${b.horario}`)),
  ];
  const passadas = (minhas.data ?? [])
    .filter((p) => p.status === "finalizada" && !estaPendenteAvaliacao(p))
    .sort((a, b) => `${b.data}${b.horario}`.localeCompare(`${a.data}${a.horario}`));

  const lista = aba === "passadas" ? passadas : proximas;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      <header className="bg-primary px-4 pt-6 pb-6">
        <h1 className="text-lg font-bold text-primary-foreground">Minhas partidas</h1>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-primary-foreground/10 p-1">
          {(
            [
              ["proximas", "Próximas"],
              ["passadas", "Passadas"],
            ] as const
          ).map(([a, rotulo]) => (
            <Link
              key={a}
              to="/minhas-partidas"
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

      <main className="flex-1 space-y-3 px-4 py-4">
        {carregando || minhas.isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)
        ) : lista.length === 0 ? (
          <div className="mt-16 space-y-3 text-center">
            <p className="text-base font-semibold text-foreground">
              {aba === "passadas" ? "Nenhuma pelada jogada ainda" : "Nenhuma pelada por aqui"}
            </p>
            <p className="text-sm text-muted-foreground">
              {aba === "passadas"
                ? "Depois que uma pelada sua terminar, ela aparece aqui."
                : "Crie a sua ou entre em alguma pelo feed."}
            </p>
            {aba === "proximas" && (
              <Button asChild className="mt-2 bg-mint text-mint-foreground hover:bg-mint/90">
                <Link to="/">Ver feed</Link>
              </Button>
            )}
          </div>
        ) : (
          lista.map((p) => (
            <MatchCard
              key={p.id}
              pelada={p}
              voltarPara={aba === "passadas" ? "partidas-passadas" : "partidas-proximas"}
            />
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}
