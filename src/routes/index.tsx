import type { ReactNode } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { CalendarDays, CalendarPlus, Flag, MapPin, Trophy } from "lucide-react";
import { useSession, usePerfil } from "@/hooks/use-session";
import { DIAS_NO_FEED, useFeed } from "@/hooks/use-feed";
import { GoatingLogo } from "@/components/goating/logo";
import { Apresentacao } from "@/components/goating/apresentacao";
import { Sino } from "@/components/goating/sino";
import { BottomNav } from "@/components/goating/bottom-nav";
import { PuxarParaAtualizar } from "@/components/goating/puxar-para-atualizar";
import { Segmentos, classeSegmento } from "@/components/goating/titulo-grande";
import { MatchCard } from "@/components/goating/match-card";
import { EmBreve } from "@/components/goating/em-breve";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Aba = "proximas" | "finalizadas";
/** as duas seções do feed: as peladas (padrão) e os campeonatos (em breve) */
type Secao = "peladas" | "campeonatos";

export const Route = createFileRoute("/")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { aba?: Aba | undefined; secao?: Secao | undefined } => ({
    aba:
      search["aba"] === "finalizadas" || search["aba"] === "proximas" ? search["aba"] : undefined,
    secao: search["secao"] === "campeonatos" ? "campeonatos" : undefined,
  }),
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

function Feed() {
  const navigate = useNavigate();
  const { aba: abaDaUrl, secao } = useSearch({ from: "/" });
  const vendoCampeonatos = secao === "campeonatos";
  const { userId, carregando } = useSession();
  const { data: perfil, isLoading: carregandoPerfil } = usePerfil(userId);

  const cidade = perfil?.cidade ?? null;
  const feed = useFeed(carregandoPerfil ? null : userId, cidade);
  // sem aba escolhida: quem tem avaliação pendente já cai nas finalizadas, pra não esquecer
  const aba: Aba = abaDaUrl ?? (feed.data?.temPendencia ? "finalizadas" : "proximas");

  // a busca saiu do feed por enquanto (pouco usada); a lista é a da aba inteira
  const lista = (aba === "finalizadas" ? feed.data?.finalizadas : feed.data?.proximas) ?? [];
  const aAvaliar = feed.data?.aAvaliar ?? 0;

  // quem não entrou vê a apresentação do app (o que é, entrar, política de privacidade)
  if (!carregando && !userId) return <Apresentacao />;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-background">
      <header className="bg-primary px-4 pt-3">
        <div className="flex items-center justify-between">
          <GoatingLogo size={26} withWordmark iconTone="light" wordmarkTone="dark" />
          <Sino />
        </div>
      </header>

      {/* seções e abas acompanham a rolagem; a base arredondada fecha o bloco verde */}
      <div className="sticky top-[var(--topo)] z-20 -mt-px space-y-3 rounded-b-3xl bg-primary px-4 pt-3 pb-3">
        {/* as duas seções do feed, bem à vista: peladas e campeonatos */}
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["peladas", "Peladas", CalendarDays],
              ["campeonatos", "Campeonatos", Trophy],
            ] as const
          ).map(([s, rotulo, Icone]) => {
            const ativa = (s === "campeonatos") === vendoCampeonatos;
            return (
              <Link
                key={s}
                to="/"
                search={s === "campeonatos" ? { secao: s } : {}}
                replace
                aria-current={ativa ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-extrabold transition-colors",
                  ativa
                    ? "bg-card text-primary shadow-sm"
                    : "bg-white/10 text-primary-foreground/80",
                )}
              >
                <Icone className="size-4" />
                {rotulo}
                {s === "campeonatos" && (
                  <span className="rounded-full bg-tier-ouro px-1.5 py-px text-[9px] font-extrabold text-primary uppercase">
                    breve
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {!vendoCampeonatos && (
          <>
            {/* o que é essa lista, em uma frase */}
            <div>
              <h1 className="flex items-center gap-1.5 text-lg leading-tight font-extrabold text-primary-foreground">
                {cidade ? (
                  <>
                    <MapPin className="size-4 shrink-0 text-mint" />
                    <span className="truncate">Peladas em {cidade}</span>
                  </>
                ) : (
                  "Suas peladas"
                )}
              </h1>
              <p className="mt-0.5 text-xs text-primary-foreground/70">
                {aba === "finalizadas"
                  ? "As que você jogou, com placar, MVP e as notas pra dar."
                  : `As suas e as abertas na cidade nos próximos ${DIAS_NO_FEED} dias. Toque numa pra ver e entrar.`}
              </p>
            </div>
            <Segmentos colunas={2}>
              {(
                [
                  ["proximas", "Próximas"],
                  ["finalizadas", "Finalizadas"],
                ] as const
              ).map(([a, rotulo]) => (
                <Link
                  key={a}
                  to="/"
                  // a escolha vai pra URL nos dois casos: tocar em "Próximas" tem que valer
                  search={{ aba: a }}
                  replace
                  className={classeSegmento(aba === a)}
                >
                  {rotulo}
                  {a === "finalizadas" && aAvaliar > 0 && (
                    <span className="ml-1.5 rounded-full bg-tier-ouro px-1.5 py-px text-[10px] font-extrabold text-primary">
                      {aAvaliar}
                    </span>
                  )}
                </Link>
              ))}
            </Segmentos>
          </>
        )}
      </div>

      <main className="flex-1 space-y-3 px-4 py-4">
        {vendoCampeonatos ? (
          <EmBreve
            icone={Trophy}
            titulo="Campeonatos"
            texto="Torneios entre times da sua cidade, com tabela, chaveamento e artilharia."
          />
        ) : carregando || carregandoPerfil || (!!userId && feed.isLoading) ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-36 w-full rounded-3xl" />)
        ) : !userId ? (
          <div className="mt-16 text-center">
            <p className="text-sm text-muted-foreground">
              Entre na sua conta para ver as peladas da sua cidade.
            </p>
            <Button asChild className="mt-4">
              <Link to="/auth">Entrar no Goating</Link>
            </Button>
          </div>
        ) : feed.isError ? (
          <Vazio
            icone={<Flag className="size-7 text-primary" strokeWidth={1.8} />}
            titulo="Não conseguimos carregar as peladas"
            texto="Confere a internet e puxa a tela pra baixo pra tentar de novo."
          />
        ) : lista.length === 0 ? (
          aba === "finalizadas" ? (
            <Vazio
              icone={<Flag className="size-7 text-primary" strokeWidth={1.8} />}
              titulo="Nenhuma pelada finalizada ainda"
              texto="As peladas que você jogar aparecem aqui, com o placar e as avaliações."
            />
          ) : !cidade ? (
            <div className="mt-12 space-y-3 text-center">
              <p className="text-base font-semibold text-foreground">Falta só um passo</p>
              <p className="text-sm text-muted-foreground">
                Complete seu cadastro para ver as peladas perto de você.
              </p>
              <Button className="mt-2" onClick={() => void navigate({ to: "/perfil" })}>
                Completar cadastro
              </Button>
            </div>
          ) : (
            <Vazio
              icone={<CalendarPlus className="size-7 text-primary" strokeWidth={1.8} />}
              titulo={`Nenhuma pelada em ${cidade} nos próximos ${DIAS_NO_FEED} dias`}
              texto="Toque no + aqui embaixo pra organizar a primeira."
            />
          )
        ) : (
          lista.map((p) => <MatchCard key={p.id} pelada={p} />)
        )}
      </main>

      <PuxarParaAtualizar />
      <BottomNav />
    </div>
  );
}

function Vazio({ icone, titulo, texto }: { icone: ReactNode; titulo: string; texto: string }) {
  return (
    <div className="mt-12 flex flex-col items-center px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-mint-soft">
        {icone}
      </span>
      <p className="mt-4 text-base font-semibold text-foreground">{titulo}</p>
      <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}
