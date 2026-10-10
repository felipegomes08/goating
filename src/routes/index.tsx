import { useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Bell, CalendarPlus, Flag, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { useSession, usePerfil } from "@/hooks/use-session";
import { DIAS_NO_FEED, useFeed } from "@/hooks/use-feed";
import { GoatingLogo } from "@/components/goating/logo";
import { BottomNav } from "@/components/goating/bottom-nav";
import { PuxarParaAtualizar } from "@/components/goating/puxar-para-atualizar";
import { CAMPO_NO_VERDE, Segmentos, classeSegmento } from "@/components/goating/titulo-grande";
import { MatchCard } from "@/components/goating/match-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Aba = "proximas" | "finalizadas";

export const Route = createFileRoute("/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { aba?: Aba | undefined } => ({
    aba: search["aba"] === "finalizadas" ? "finalizadas" : undefined,
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
  const { aba: abaDaUrl } = useSearch({ from: "/" });
  const aba: Aba = abaDaUrl ?? "proximas";
  const { userId, carregando } = useSession();
  const { data: perfil, isLoading: carregandoPerfil } = usePerfil(userId);
  const [busca, setBusca] = useState("");

  const cidade = perfil?.cidade ?? null;
  const feed = useFeed(carregandoPerfil ? null : userId, cidade);

  const termo = busca.trim().toLowerCase();
  const daAba = (aba === "finalizadas" ? feed.data?.finalizadas : feed.data?.proximas) ?? [];
  const lista = termo
    ? daAba.filter((p) =>
        [p.titulo, p.cidade, p.local, p.turma ?? ""].some((c) => c.toLowerCase().includes(termo)),
      )
    : daAba;
  const aAvaliar = feed.data?.aAvaliar ?? 0;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-background">
      <header className="bg-primary px-4 pt-5 pb-1">
        <div className="flex items-center justify-between">
          <GoatingLogo withWordmark iconTone="light" wordmarkTone="dark" />
          <button
            type="button"
            aria-label="Notificações"
            onClick={() => toast("Notificações chegam em breve.")}
            className="flex size-9 items-center justify-center rounded-full bg-white/10 text-primary-foreground active:opacity-60"
          >
            <Bell className="size-[18px]" />
          </button>
        </div>
        {cidade && (
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-mint">
            <MapPin className="size-3.5" />
            {cidade}
          </p>
        )}
      </header>

      {/* busca e abas acompanham a rolagem; a base arredondada fecha o bloco verde */}
      <div className="sticky top-0 z-20 -mt-px space-y-2 rounded-b-3xl bg-primary px-4 pt-2 pb-4">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary-foreground/55" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por pelada, quadra ou turma"
            className={CAMPO_NO_VERDE}
          />
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
              search={a === "finalizadas" ? { aba: a } : {}}
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
      </div>

      <main className="flex-1 space-y-3 px-4 py-4">
        {carregando || carregandoPerfil || (!!userId && feed.isLoading) ? (
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
          termo ? (
            <Vazio
              icone={<Search className="size-7 text-primary" strokeWidth={1.8} />}
              titulo="Nada com esse nome"
              texto="Tenta outro nome de pelada, quadra ou turma."
            />
          ) : aba === "finalizadas" ? (
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
