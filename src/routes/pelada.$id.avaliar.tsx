import { useState } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pelada/$id/avaliar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Avaliar jogadores · Goating" },
      {
        name: "description",
        content: "Dê nota de 0 a 10 para quem jogou com você e ajude a definir o overall de cada um.",
      },
      { property: "og:title", content: "Avaliar jogadores · Goating" },
      {
        property: "og:description",
        content: "As notas da galera definem o overall e o tier da cartinha de cada jogador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Avaliar,
  errorComponent: () => <Aviso texto="Não conseguimos carregar as avaliações." />,
  notFoundComponent: () => <Aviso texto="Essa pelada não existe mais." />,
});

function Aviso({ texto }: { texto: string }) {
  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm text-muted-foreground">{texto}</p>
      <Button asChild>
        <Link to="/">Voltar ao feed</Link>
      </Button>
    </div>
  );
}

const ATRIBUTOS = [
  { chave: "chute", rotulo: "Chute" },
  { chave: "drible", rotulo: "Drible" },
  { chave: "velocidade", rotulo: "Velocidade" },
  { chave: "toque", rotulo: "Toque de bola" },
  { chave: "posicionamento", rotulo: "Posicionamento" },
  { chave: "comportamento", rotulo: "Comportamento" },
  { chave: "pontualidade", rotulo: "Pontualidade" },
] as const;

type ChaveAtributo = (typeof ATRIBUTOS)[number]["chave"];
type Notas = { nota_geral: number } & Record<ChaveAtributo, number>;

const NOTAS_INICIAIS: Notas = {
  nota_geral: 7,
  chute: 7,
  drible: 7,
  velocidade: 7,
  toque: 7,
  posicionamento: 7,
  comportamento: 8,
  pontualidade: 8,
};

function iniciais(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Avaliar() {
  const { id } = useParams({ from: "/pelada/$id/avaliar" });
  const { userId, carregando } = useSession();
  const navigate = useNavigate();
  const [indice, setIndice] = useState(0);
  const [notas, setNotas] = useState<Notas>(NOTAS_INICIAIS);
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  const consulta = useQuery({
    queryKey: ["avaliar", id, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: pelada, error } = await supabase
        .from("matches")
        .select("id, titulo, status, finalizada_em")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!pelada) return null;

      const [{ data: parts }, { data: feitas }] = await Promise.all([
        supabase
          .from("match_participants")
          .select("user_id")
          .eq("match_id", id)
          .eq("status", "aprovado"),
        supabase
          .from("evaluations")
          .select("avaliado_id")
          .eq("match_id", id)
          .eq("avaliador_id", userId!),
      ]);

      const jaAvaliados = new Set((feitas ?? []).map((f) => f.avaliado_id));
      const alvos = (parts ?? [])
        .map((p) => p.user_id)
        .filter((uid) => uid !== userId && !jaAvaliados.has(uid));

      const { data: perfis } = alvos.length
        ? await supabase.from("profiles").select("id, nome_exibicao, foto_url").in("id", alvos)
        : { data: [] };

      return {
        pelada,
        jogadores: alvos.map((uid) => {
          const p = (perfis ?? []).find((x) => x.id === uid);
          return { id: uid, nome: p?.nome_exibicao ?? "Jogador", foto: p?.foto_url ?? null };
        }),
      };
    },
  });

  if (carregando || consulta.isLoading) {
    return (
      <div className="app-shell space-y-3 p-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (!userId) {
    return <Aviso texto="Entre na sua conta para avaliar os jogadores." />;
  }
  if (!consulta.data) return <Aviso texto="Essa pelada não existe mais." />;

  const { pelada, jogadores } = consulta.data;
  const janelaAberta =
    pelada.status === "finalizada" &&
    !!pelada.finalizada_em &&
    Date.now() - new Date(pelada.finalizada_em).getTime() < 24 * 60 * 60 * 1000;

  if (!janelaAberta) {
    return <Aviso texto="A janela de 24 horas para avaliar essa pelada já fechou." />;
  }

  const jogador = jogadores[indice];

  if (concluido || !jogador) {
    return (
      <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-mint-soft">
          <Check className="size-8 text-primary" />
        </div>
        <h1 className="text-xl font-extrabold text-foreground">Avaliações enviadas!</h1>
        <p className="text-sm text-muted-foreground">
          As notas da galera atualizam o overall e o tier de cada jogador.
        </p>
        <Button asChild className="bg-mint text-mint-foreground hover:bg-mint/90">
          <Link to="/pelada/$id" params={{ id }}>
            Voltar para a pelada
          </Link>
        </Button>
      </div>
    );
  }

  async function enviar() {
    if (!jogador) return;
    setEnviando(true);
    const { error } = await supabase.from("evaluations").insert({
      match_id: id,
      avaliador_id: userId!,
      avaliado_id: jogador.id,
      ...notas,
    });
    setEnviando(false);
    if (error) {
      toast.error("Não deu pra enviar essa avaliação.");
      return;
    }
    toast.success(`Nota enviada para ${jogador.nome}.`);
    setNotas(NOTAS_INICIAIS);
    if (indice + 1 >= jogadores.length) {
      setConcluido(true);
    } else {
      setIndice((i) => i + 1);
    }
  }

  function atualizar(chave: keyof Notas, valor: number) {
    setNotas((n) => ({ ...n, [chave]: valor }));
  }

  return (
    <div className="app-shell flex min-h-screen flex-col pb-28">
      <header className="bg-primary px-4 pt-4 pb-5">
        <div className="flex items-center gap-3">
          <button
            aria-label="Voltar"
            onClick={() => navigate({ to: "/pelada/$id", params: { id } })}
          >
            <ArrowLeft className="size-5 text-primary-foreground" />
          </button>
          <span className="text-xs font-semibold tracking-wide text-mint uppercase">
            Avaliação pós-pelada
          </span>
        </div>
        <h1 className="mt-3 text-xl font-extrabold text-primary-foreground">{pelada.titulo}</h1>
        <p className="mt-1 text-sm text-mint">
          Jogador {indice + 1} de {jogadores.length}
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-primary-foreground/15">
          <div
            className="h-full rounded-full bg-mint"
            style={{ width: `${((indice + 1) / jogadores.length) * 100}%` }}
          />
        </div>
      </header>

      <div className="flex-1 space-y-4 p-4">
        <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          {jogador.foto ? (
            <img src={jogador.foto} alt={jogador.nome} className="size-12 rounded-full object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {iniciais(jogador.nome)}
            </span>
          )}
          <div>
            <p className="text-base font-bold text-foreground">{jogador.nome}</p>
            <p className="text-xs text-muted-foreground">Notas de 0 a 10</p>
          </div>
        </div>

        <div className="rounded-2xl bg-mint-soft p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-bold text-primary">
              <Star className="size-4" /> Nota geral
            </span>
            <span className="text-2xl font-extrabold text-primary">
              {notas.nota_geral.toFixed(1)}
            </span>
          </div>
          <Slider
            className="mt-3"
            value={[notas.nota_geral]}
            min={0}
            max={10}
            step={0.5}
            onValueChange={(v) => atualizar("nota_geral", v[0] ?? 0)}
          />
        </div>

        <div className="space-y-4 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          {ATRIBUTOS.map((a) => (
            <div key={a.chave}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{a.rotulo}</span>
                <span className="font-bold text-primary">{notas[a.chave].toFixed(1)}</span>
              </div>
              <Slider
                className="mt-2"
                value={[notas[a.chave]]}
                min={0}
                max={10}
                step={0.5}
                onValueChange={(v) => atualizar(a.chave, v[0] ?? 0)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t border-border bg-card p-4">
        {indice + 1 < jogadores.length && (
          <Button
            variant="outline"
            className="flex-1"
            disabled={enviando}
            onClick={() => {
              setNotas(NOTAS_INICIAIS);
              setIndice((i) => i + 1);
            }}
          >
            Pular
          </Button>
        )}
        <Button
          className={cn("flex-1 bg-mint font-semibold text-mint-foreground hover:bg-mint/90")}
          disabled={enviando}
          onClick={enviar}
        >
          {indice + 1 >= jogadores.length ? "Enviar e concluir" : "Enviar nota"}
        </Button>
      </div>
    </div>
  );
}
