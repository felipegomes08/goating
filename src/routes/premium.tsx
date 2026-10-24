import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  Crown,
  Eye,
  Frame,
  Lock,
  GitCompareArrows,
  Medal,
  Sparkles,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useVoltar } from "@/hooks/use-voltar";
import { usePremium } from "@/hooks/use-premium";
import { BottomNav } from "@/components/goating/bottom-nav";
import { AssinarPremium } from "@/components/goating/assinar-premium";

export const Route = createFileRoute("/premium")({
  ssr: false,
  // `recurso`: o que a pessoa tentou ver quando tocou no cadeado
  validateSearch: (
    search: Record<string, unknown>,
  ): { recurso?: string | undefined; assinou?: 1 | undefined } => ({
    recurso: typeof search["recurso"] === "string" ? search["recurso"].slice(0, 60) : undefined,
    // volta do pagamento do Stripe: a tela espera o Premium ligar
    assinou: search["assinou"] === 1 || search["assinou"] === "1" ? 1 : undefined,
  }),
  head: () => ({ meta: [{ title: "Premium · Goating" }] }),
  component: Premium,
});

type Beneficio = { icone: LucideIcon; titulo: string; texto: string };

/** O que o Premium dá, nas três frentes: aparência, disputa e dados. */
const FRENTES: { titulo: string; itens: Beneficio[] }[] = [
  {
    titulo: "Apareça",
    itens: [
      {
        icone: Eye,
        titulo: "Carta completa",
        texto: "Suas notas de cada habilidade visíveis pra você e pra quem visitar seu perfil.",
      },
      {
        icone: Frame,
        titulo: "Molduras exclusivas",
        texto:
          "Inferno, Tempestade, Cristais, Furacão, Era do Gelo e mais, na carta e na imagem compartilhada.",
      },
      {
        icone: Crown,
        titulo: "Selo Premium",
        texto: "A coroa ao lado do seu nome na lista da pelada, nos times e no ranking.",
      },
      {
        icone: Medal,
        titulo: "Medalhas douradas",
        texto: "Suas conquistas em ouro, brilhando, e medalhas que só quem é Premium tem.",
      },
      {
        icone: Medal,
        titulo: "Galeria de MVPs",
        texto: "Todos os seus MVPs guardados, com cartas especiais no 5º, 10º e 20º.",
      },
    ],
  },
  {
    titulo: "Dispute",
    itens: [
      {
        icone: Trophy,
        titulo: "Ranking completo",
        texto: "Veja todo mundo do ranking geral e da cidade, não só o top 3.",
      },
      {
        icone: TrendingUp,
        titulo: "Subiu ou caiu",
        texto: "Setinhas de posição e o histórico de onde você estava a cada semana.",
      },
      {
        icone: Sparkles,
        titulo: "Ranking da turma do seu jeito",
        texto: "Ordene por gols, assistências e MVPs, e veja o mês ou o ano.",
      },
    ],
  },
  {
    titulo: "Evolua",
    itens: [
      {
        icone: Trophy,
        titulo: "Sua carreira inteira",
        texto: "Todos os gols, assistências e defesas que você já fez no Goating, em destaque.",
      },
      {
        icone: BarChart3,
        titulo: "Raio-X das avaliações",
        texto: "Sua média em cada habilidade, onde melhorou e onde a galera acha que dá pra subir.",
      },
      {
        icone: GitCompareArrows,
        titulo: "Comparar jogadores",
        texto: "Sua carta e a de outro jogador lado a lado, habilidade por habilidade.",
      },
    ],
  },
];

function Premium() {
  const navigate = useNavigate();
  const { premium } = usePremium();
  const { recurso, assinou } = useSearch({ from: "/premium" });
  const voltar = useVoltar(() => void navigate({ to: "/perfil", replace: true }));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-background">
      <header className="relative overflow-hidden bg-primary px-4 pt-4 pb-8 text-center">
        <button
          type="button"
          aria-label="Voltar"
          onClick={voltar}
          className="absolute top-4 left-4"
        >
          <ArrowLeft className="size-5 text-primary-foreground" />
        </button>
        <span className="mx-auto mt-6 flex size-16 items-center justify-center rounded-full bg-tier-ouro/20">
          <Crown className="size-8 fill-tier-ouro text-tier-ouro" />
        </span>
        <h1 className="mt-3 text-2xl font-extrabold text-primary-foreground">Goating Premium</h1>
        <p className="mt-1 text-sm text-primary-foreground/80">
          Mostre sua carta completa, dispute o ranking inteiro e acompanhe sua evolução.
        </p>
      </header>

      <main className="flex-1 space-y-5 px-4 py-5">
        {recurso && !premium && (
          <p className="flex items-center gap-2 rounded-2xl border border-tier-ouro/50 bg-tier-ouro/15 px-4 py-3 text-sm font-semibold text-foreground">
            <Lock className="size-4 shrink-0 text-tier-ouro" />
            {recurso} faz parte do Premium.
          </p>
        )}

        <AssinarPremium voltouDoPagamento={!!assinou} />
        {FRENTES.map((f) => (
          <section key={f.titulo} className="space-y-2">
            <h2 className="px-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
              {f.titulo}
            </h2>
            <ul className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]">
              {f.itens.map((b) => (
                <li
                  key={b.titulo}
                  className="flex items-start gap-3 border-b border-border px-3 py-3 last:border-0"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tier-ouro/15 text-tier-ouro">
                    <b.icone className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-foreground">{b.titulo}</span>
                    <span className="block text-xs text-muted-foreground">{b.texto}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <p className="px-1 text-center text-xs text-muted-foreground">
          Seu nível (Bronze ao GOAT) continua sendo conquistado jogando. O Premium não compra nível.
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
