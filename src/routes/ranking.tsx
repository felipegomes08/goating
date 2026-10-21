import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePerfil } from "@/hooks/use-session";
import { BottomNav } from "@/components/goating/bottom-nav";
import { PuxarParaAtualizar } from "@/components/goating/puxar-para-atualizar";
import {
  CAMPO_NO_VERDE,
  Segmentos,
  TituloGrande,
  classeSegmento,
} from "@/components/goating/titulo-grande";
import { JogadorItem, type JogadorResumo } from "@/components/goating/jogador-item";
import { RankingDeTurma } from "@/components/goating/ranking-de-turma";
import { RankingDeTurmasDaCidade } from "@/components/goating/ranking-de-turmas-da-cidade";
import { PodioDoRanking } from "@/components/goating/podio-do-ranking";
import { FolhaPremium } from "@/components/goating/cadeado";
import { usePremium } from "@/hooks/use-premium";
import { useHistoricoNoRanking, usePosicoesDaSemana } from "@/hooks/use-ranking-semanal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MIN_AVALIACOES, avaliacoesFaltando, tierPorNome } from "@/lib/tiers";

type Aba = "cidade" | "seguindo" | "geral" | "turma";

export const Route = createFileRoute("/ranking")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { aba: Aba; turma?: string | undefined; ver?: "turmas" | undefined } => ({
    aba:
      search["aba"] === "seguindo"
        ? "seguindo"
        : search["aba"] === "geral"
          ? "geral"
          : search["aba"] === "turma"
            ? "turma"
            : "cidade",
    // qual turma está aberta na aba Turma
    turma: typeof search["turma"] === "string" ? search["turma"] : undefined,
    // na aba Cidade: ranking de jogadores (padrão) ou de turmas
    ver: search["ver"] === "turmas" ? "turmas" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ranking · Goating" },
      {
        name: "description",
        content:
          "Veja o ranking dos jogadores por cartinha e XP na sua cidade, entre quem você segue ou geral, ou busque por nome.",
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
  "id, nome_exibicao, handle, cidade, foto_url, overall, peladas_jogadas, xp, tier_reconhecido, avaliacoes_recebidas, posicao_preferida, vezes_mvp, plano, premium_ate";

/**
 * Ordem do ranking: primeiro a cartinha (o tier que aparece na tela), depois XP, depois
 * overall. O tier já exige XP e overall mínimos, então um Lendário nunca fica abaixo de um
 * Bronze — o que acontecia ordenando só por overall, e ainda poderia acontecer ordenando só
 * por XP (muito XP com overall baixo continua Bronze).
 * O banco devolve os 100 de mais XP e a ordem final é feita aqui, porque o tier é texto.
 */
function ordenarRanking(jogadores: JogadorResumo[]) {
  const ordemDoTier = (j: JogadorResumo) => tierPorNome(j.tier_reconhecido)?.ordem ?? 0;
  return [...jogadores].sort(
    (a, b) =>
      ordemDoTier(b) - ordemDoTier(a) || b.xp - a.xp || Number(b.overall) - Number(a.overall),
  );
}

function Ranking() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { aba, turma: turmaDaUrl, ver } = useSearch({ from: "/ranking" });
  const { userId, carregando } = useSession();
  const { data: perfil } = usePerfil(userId);
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState("");
  const [ocupados, setOcupados] = useState<Set<string>>(new Set());
  const [convite, setConvite] = useState<string | null>(null);
  const { premium } = usePremium();

  useEffect(() => {
    if (!carregando && !userId) navigate({ to: "/auth", replace: true });
  }, [carregando, userId, navigate]);

  useEffect(() => {
    const t = setTimeout(() => setBusca(termo.trim()), 300);
    return () => clearTimeout(t);
  }, [termo]);

  const cidade = perfil?.cidade ?? null;
  const naTurma = aba === "turma";
  // a busca é de jogadores; na aba Turma ela some e não vale
  const buscando = !!busca && !naTurma;
  const vendoTurmas = aba === "cidade" && ver === "turmas" && !buscando;

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
    enabled: !!userId && !naTurma,
    queryFn: async (): Promise<JogadorResumo[]> => {
      if (busca) {
        // vírgula, parênteses e % quebrariam o filtro "or"; o @ é só enfeite de quem digita
        const termoLimpo = busca.replace(/^@/, "").replace(/[,()%*\\]/g, " ");
        const { data, error } = await supabase
          .from("profiles")
          .select(CAMPOS)
          .neq("id", userId!)
          .eq("eh_convidado", false)
          .or(`nome_exibicao.ilike.%${termoLimpo}%,handle.ilike.%${termoLimpo}%`)
          .order("xp", { ascending: false })
          .limit(30);
        if (error) throw error;
        return ordenarRanking((data ?? []) as JogadorResumo[]);
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
          .order("xp", { ascending: false })
          .order("overall", { ascending: false })
          .limit(100);
        if (erroPerfis) throw erroPerfis;
        return ordenarRanking((data ?? []) as JogadorResumo[]);
      }

      let q = supabase.from("profiles").select(CAMPOS).gte("avaliacoes_recebidas", MIN_AVALIACOES);
      if (aba === "cidade" && cidade) q = q.eq("cidade", cidade);
      const { data, error } = await q
        .order("xp", { ascending: false })
        .order("overall", { ascending: false })
        .limit(100);
      if (error) throw error;
      return ordenarRanking((data ?? []) as JogadorResumo[]);
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

  // Premium: setinhas de subiu/caiu (comparando com a foto semanal) e o histórico da posição.
  // Geral e Cidade, sem Premium: pódio, a sua linha e o resto borrado.
  const disputa = !buscando && (aba === "geral" || aba === "cidade");
  const travado = disputa && !premium;
  const semana = usePosicoesDaSemana(aba === "cidade" ? "cidade" : "geral", disputa && premium);
  const historico = useHistoricoNoRanking(userId, disputa && premium);
  const variacaoDe = (id: string, posicao: number) => {
    if (!disputa || !premium) return undefined;
    const antes = semana.data?.get(id);
    return antes ? antes - posicao : null;
  };
  const jogadores = lista.data ?? [];
  const comPodio = !buscando && jogadores.length >= 3;
  const resto = comPodio ? jogadores.slice(3) : jogadores;
  const inicioDoResto = comPodio ? 4 : 1;
  const borrados = resto.filter((j) => j.id !== userId).slice(0, 5);

  const linha = (j: JogadorResumo, posicao: number | undefined) => (
    <div
      key={j.id}
      className={
        j.id === userId ? "rounded-2xl ring-2 ring-mint ring-offset-2 ring-offset-background" : ""
      }
    >
      <JogadorItem
        jogador={j}
        posicao={posicao}
        variacao={posicao ? variacaoDe(j.id, posicao) : undefined}
        seguindo={buscando ? (meusSeguidos.data?.has(j.id) ?? false) : undefined}
        ocupado={ocupados.has(j.id)}
        onAlternarSeguir={
          buscando ? () => alternarSeguir(j.id, meusSeguidos.data?.has(j.id) ?? false) : undefined
        }
      />
    </div>
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-background">
      <TituloGrande titulo="Ranking">
        {!naTurma && (
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary-foreground/55" />
            <Input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar jogador pelo nome ou @nick"
              className={CAMPO_NO_VERDE}
              aria-label="Buscar por nome de exibição"
            />
          </div>
        )}

        {!buscando && (
          <Segmentos colunas={4}>
            {(
              [
                ["cidade", "Cidade"],
                ["seguindo", "Seguindo"],
                ["geral", "Geral"],
                ["turma", "Turma"],
              ] as const
            ).map(([a, rotulo]) => (
              <Link
                key={a}
                to="/ranking"
                search={{ aba: a }}
                replace
                className={classeSegmento(aba === a)}
              >
                {rotulo}
              </Link>
            ))}
          </Segmentos>
        )}
      </TituloGrande>

      <main className="flex-1 space-y-2 px-4 py-4">
        {naTurma && userId ? (
          <RankingDeTurma
            userId={userId}
            turmaId={turmaDaUrl}
            onEscolher={(crewId) =>
              void navigate({
                to: "/ranking",
                search: { aba: "turma", turma: crewId },
                replace: true,
              })
            }
          />
        ) : (
          <>
            {aba === "cidade" && cidade && !buscando && (
              <div className="flex items-center justify-between gap-3 px-1">
                <p className="min-w-0 truncate text-xs font-semibold text-muted-foreground">
                  {vendoTurmas ? "Turmas" : "Jogadores"} de {cidade}
                </p>
                <div className="flex shrink-0 gap-1 rounded-full bg-secondary p-0.5">
                  {(
                    [
                      [undefined, "Jogadores"],
                      ["turmas", "Turmas"],
                    ] as const
                  ).map(([valor, rotulo]) => (
                    <Link
                      key={rotulo}
                      to="/ranking"
                      search={{ aba: "cidade", ...(valor ? { ver: valor } : {}) }}
                      replace
                      className={
                        ver === valor
                          ? "rounded-full bg-card px-3 py-1 text-xs font-bold text-foreground shadow-sm"
                          : "rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground"
                      }
                    >
                      {rotulo}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {vendoTurmas && cidade && <RankingDeTurmasDaCidade cidade={cidade} />}
            {!vendoTurmas && (
              <>
                {!buscando && !liberado && aba !== "seguindo" && (
                  <p className="rounded-2xl bg-mint-soft p-3 text-xs font-medium text-primary">
                    Faltam {avaliacoesFaltando(perfil?.avaliacoes_recebidas ?? 0)} avaliações
                    pós-pelada pra você aparecer no ranking.
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
                ) : buscando ? (
                  jogadores.map((j) => linha(j, undefined))
                ) : (
                  <>
                    {comPodio && (
                      <PodioDoRanking jogadores={jogadores.slice(0, 3)} userId={userId} />
                    )}
                    {travado ? (
                      <>
                        {minhaPosicao > 3 && linha(jogadores[minhaPosicao - 1]!, minhaPosicao)}
                        {borrados.length > 0 && (
                          <div className="relative">
                            <div
                              aria-hidden
                              className="pointer-events-none space-y-2 blur-[6px] select-none"
                            >
                              {borrados.map((j) => (
                                <JogadorItem key={j.id} jogador={j} posicao={0} />
                              ))}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => setConvite("Ranking completo")}
                                className="flex flex-col items-center gap-1 rounded-2xl bg-card/95 px-5 py-4 text-center shadow-[var(--shadow-card)]"
                              >
                                <Lock className="size-5 text-tier-ouro" />
                                <span className="text-sm font-extrabold text-foreground">
                                  Ver ranking completo
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {resto.length} {resto.length === 1 ? "jogador" : "jogadores"}{" "}
                                  depois do top 3 · Premium
                                </span>
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      resto.map((j, i) => linha(j, inicioDoResto + i))
                    )}
                  </>
                )}

                {euApareco && disputa && (
                  <div className="sticky bottom-20 z-10 pt-2">
                    <div className="flex items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-lg">
                      <span className="text-2xl font-black tabular-nums">{minhaPosicao}º</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold">
                          Você está em {minhaPosicao}º
                        </span>
                        {premium ? (
                          <span className="block truncate text-xs text-mint">
                            {(() => {
                              const v = variacaoDe(userId!, minhaPosicao);
                              const semanas = (historico.data ?? [])
                                .map((h) => (aba === "cidade" ? h.posicao_cidade : h.posicao_geral))
                                .filter((p): p is number => p != null);
                              const texto =
                                v == null || v === 0
                                  ? "Mesma posição da semana passada"
                                  : v > 0
                                    ? `Subiu ${v} desde a semana passada`
                                    : `Caiu ${-v} desde a semana passada`;
                              return semanas.length > 1
                                ? `${texto} · ${semanas.map((p) => `${p}º`).join(" → ")}`
                                : texto;
                            })()}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConvite("Subiu ou caiu")}
                            className="flex items-center gap-1 text-xs text-mint"
                          >
                            <Lock className="size-3 text-tier-ouro" /> Veja se subiu ou caiu na
                            semana
                          </button>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {convite && <FolhaPremium recurso={convite} onFechar={() => setConvite(null)} />}
      <PuxarParaAtualizar />
      <BottomNav />
    </div>
  );
}
