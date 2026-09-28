import { useState } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronDown, ChevronLeft, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pelada/$id_/avaliar")({
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
type Atributos = Record<ChaveAtributo, number>;

const NOTA_PADRAO = 7;

function atributosIguais(valor: number): Atributos {
  return Object.fromEntries(ATRIBUTOS.map((a) => [a.chave, valor])) as Atributos;
}

function atributosNulos() {
  return Object.fromEntries(ATRIBUTOS.map((a) => [a.chave, null])) as Record<ChaveAtributo, null>;
}

/** Nota geral = média simples dos atributos (mesma regra do trigger no banco). */
function mediaGeral(attrs: Atributos) {
  const soma = ATRIBUTOS.reduce((acc, a) => acc + attrs[a.chave], 0);
  return Math.round((soma / ATRIBUTOS.length) * 100) / 100;
}

function todosIguais(attrs: Atributos) {
  const primeiro = attrs[ATRIBUTOS[0].chave];
  return ATRIBUTOS.every((a) => attrs[a.chave] === primeiro);
}

function iniciais(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Avaliar() {
  const { id } = useParams({ from: "/pelada/$id_/avaliar" });
  const { userId, carregando } = useSession();
  const navigate = useNavigate();

  // null = ainda não navegou; começa no primeiro jogador pendente.
  const [indiceEscolhido, setIndiceEscolhido] = useState<number | null>(null);
  // Rascunhos por jogador: sobrevivem a "Anterior"/"Pular".
  const [rascunhos, setRascunhos] = useState<Record<string, Atributos>>({});
  // Jogadores avaliados nesta sessão (somados aos que já vieram do banco).
  const [enviadosAgora, setEnviadosAgora] = useState<Set<string>>(new Set());
  // null = automático (abre sozinho se a avaliação salva tiver atributos diferentes).
  const [detalhadoManual, setDetalhadoManual] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  const consulta = useQuery({
    queryKey: ["avaliar", id, userId],
    enabled: !!userId,
    refetchOnWindowFocus: false,
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
          .select(
            "avaliado_id, chute, drible, velocidade, toque, posicionamento, comportamento, pontualidade, nota_geral",
          )
          .eq("match_id", id)
          .eq("avaliador_id", userId!),
      ]);

      // Avaliações que eu já fiz, para poder revisar/corrigir.
      const salvas: Record<string, Atributos> = {};
      for (const f of feitas ?? []) {
        const geral = Number(f.nota_geral);
        salvas[f.avaliado_id] = Object.fromEntries(
          ATRIBUTOS.map((a) => [a.chave, f[a.chave] == null ? geral : Number(f[a.chave])]),
        ) as Atributos;
      }

      const alvos = (parts ?? []).map((p) => p.user_id).filter((uid) => uid !== userId);

      const { data: perfis } = alvos.length
        ? await supabase.from("profiles").select("id, nome_exibicao, foto_url").in("id", alvos)
        : { data: [] };

      const jogadores = alvos
        .map((uid) => {
          const p = (perfis ?? []).find((x) => x.id === uid);
          return { id: uid, nome: p?.nome_exibicao ?? "Jogador", foto: p?.foto_url ?? null };
        })
        // Ordem estável: a lista não muda enquanto a pessoa navega.
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

      return { pelada, jogadores, salvas };
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

  const { pelada, jogadores, salvas } = consulta.data;
  const janelaAberta =
    pelada.status === "finalizada" &&
    !!pelada.finalizada_em &&
    Date.now() - new Date(pelada.finalizada_em).getTime() < 24 * 60 * 60 * 1000;

  if (!janelaAberta) {
    return <Aviso texto="A janela de 24 horas para avaliar essa pelada já fechou." />;
  }

  const jaEnviado = (uid: string) => uid in salvas || enviadosAgora.has(uid);
  const totalEnviados = jogadores.filter((j) => jaEnviado(j.id)).length;
  const primeiroPendente = jogadores.findIndex((j) => !jaEnviado(j.id));
  const indice = indiceEscolhido ?? primeiroPendente;
  const jogador = indice >= 0 ? jogadores[indice] : undefined;

  function irPara(i: number) {
    setIndiceEscolhido(i);
    setDetalhadoManual(null);
    setConcluido(false);
  }

  if (concluido || !jogador) {
    return (
      <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-mint-soft">
          <Check className="size-8 text-primary" />
        </div>
        <h1 className="text-xl font-extrabold text-foreground">
          {jogadores.length === 0 ? "Ninguém para avaliar" : "Avaliações enviadas!"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {jogadores.length === 0
            ? "Não tem outros jogadores confirmados nessa pelada."
            : `Você avaliou ${totalEnviados} de ${jogadores.length}. Até fechar a janela de 24h dá para revisar suas notas.`}
        </p>
        <div className="flex flex-col gap-2">
          {jogadores.length > 0 && (
            <Button variant="outline" onClick={() => irPara(0)}>
              Revisar minhas notas
            </Button>
          )}
          <Button asChild className="bg-mint text-mint-foreground hover:bg-mint/90">
            <Link to="/pelada/$id" params={{ id }}>
              Voltar para a pelada
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const attrs: Atributos =
    rascunhos[jogador.id] ?? salvas[jogador.id] ?? atributosIguais(NOTA_PADRAO);
  const notaGeral = mediaGeral(attrs);
  const detalhado = detalhadoManual ?? !todosIguais(attrs);
  const enviadoEste = jaEnviado(jogador.id);
  const ultimo = indice + 1 >= jogadores.length;

  function setAttrs(novos: Atributos) {
    setRascunhos((r) => ({ ...r, [jogador!.id]: novos }));
  }

  // Modo rápido: a nota geral puxa todos os atributos junto.
  function mudarGeral(valor: number) {
    setAttrs(atributosIguais(valor));
  }

  // Modo detalhado: cada atributo muda sozinho e a geral vira a média.
  function mudarAtributo(chave: ChaveAtributo, valor: number) {
    setAttrs({ ...attrs, [chave]: valor });
  }

  async function enviar() {
    if (!jogador) return;
    setEnviando(true);
    // Avaliação rápida grava só a nota geral: atributos nulos não entram nas médias
    // do radar. Só grava os atributos quando a pessoa usou a detalhada.
    const usouDetalhada = detalhado || !todosIguais(attrs);
    const payload = usouDetalhada
      ? { ...attrs, nota_geral: notaGeral }
      : { ...atributosNulos(), nota_geral: notaGeral };

    let erro: { code?: string } | null = null;
    if (enviadoEste) {
      const { data, error } = await supabase
        .from("evaluations")
        .update(payload)
        .eq("match_id", id)
        .eq("avaliador_id", userId!)
        .eq("avaliado_id", jogador.id)
        .select("id");
      erro = error ?? (data?.length ? null : { code: "sem_permissao" });
    } else {
      const { error } = await supabase.from("evaluations").insert({
        match_id: id,
        avaliador_id: userId!,
        avaliado_id: jogador.id,
        ...payload,
      });
      erro = error;
    }
    setEnviando(false);

    if (erro) {
      toast.error(
        erro.code === "sem_permissao"
          ? "Não deu pra atualizar: a janela de avaliação pode ter fechado."
          : "Não deu pra enviar essa avaliação.",
      );
      return;
    }

    toast.success(
      enviadoEste ? `Nota de ${jogador.nome} atualizada.` : `Nota enviada para ${jogador.nome}.`,
    );
    setEnviadosAgora((s) => new Set(s).add(jogador.id));
    if (ultimo) {
      setConcluido(true);
    } else {
      irPara(indice + 1);
    }
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
          Jogador {indice + 1} de {jogadores.length} · {totalEnviados} avaliado
          {totalEnviados === 1 ? "" : "s"}
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-primary-foreground/15">
          <div
            className="h-full rounded-full bg-mint transition-all"
            style={{ width: `${(totalEnviados / jogadores.length) * 100}%` }}
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
          <div className="flex-1">
            <p className="text-base font-bold text-foreground">{jogador.nome}</p>
            <p className="text-xs text-muted-foreground">Notas de 0 a 10</p>
          </div>
          {enviadoEste && (
            <span className="flex items-center gap-1 rounded-full bg-mint-soft px-2 py-1 text-[11px] font-semibold text-primary">
              <Check className="size-3" /> Avaliado
            </span>
          )}
        </div>

        <div className="rounded-2xl bg-mint-soft p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-bold text-primary">
              <Star className="size-4" /> Nota geral
            </span>
            <span className="text-2xl font-extrabold text-primary">{notaGeral.toFixed(1)}</span>
          </div>
          {detalhado ? (
            <p className="mt-2 text-xs text-primary/70">
              Calculada pela média da avaliação detalhada.
            </p>
          ) : (
            <Slider
              className="mt-3"
              value={[notaGeral]}
              min={0}
              max={10}
              step={0.5}
              onValueChange={(v) => mudarGeral(v[0] ?? 0)}
            />
          )}
        </div>

        <div className="rounded-2xl bg-card shadow-[var(--shadow-card)]">
          <button
            type="button"
            className="flex w-full items-center justify-between p-4 text-sm font-semibold text-foreground"
            aria-expanded={detalhado}
            onClick={() => setDetalhadoManual(!detalhado)}
          >
            Avaliação detalhada
            <ChevronDown
              className={cn("size-4 text-muted-foreground transition-transform", detalhado && "rotate-180")}
            />
          </button>
          {detalhado && (
            <div className="space-y-4 px-4 pb-4">
              {ATRIBUTOS.map((a) => (
                <div key={a.chave}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{a.rotulo}</span>
                    <span className="font-bold text-primary">{attrs[a.chave].toFixed(1)}</span>
                  </div>
                  <Slider
                    className="mt-2"
                    value={[attrs[a.chave]]}
                    min={0}
                    max={10}
                    step={0.5}
                    onValueChange={(v) => mudarAtributo(a.chave, v[0] ?? 0)}
                  />
                </div>
              ))}
            </div>
          )}
          {!detalhado && !todosIguais(attrs) && (
            <p className="px-4 pb-4 text-xs text-muted-foreground">
              Mexer na nota geral deixa todos os atributos com o mesmo valor.
            </p>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t border-border bg-card p-4">
        {indice > 0 && (
          <Button
            variant="outline"
            size="icon"
            aria-label="Jogador anterior"
            disabled={enviando}
            onClick={() => irPara(indice - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}
        {!ultimo && (
          <Button
            variant="outline"
            className="flex-1"
            disabled={enviando}
            onClick={() => irPara(indice + 1)}
          >
            {enviadoEste ? "Próximo" : "Pular"}
          </Button>
        )}
        <Button
          className="flex-1 bg-mint font-semibold text-mint-foreground hover:bg-mint/90"
          disabled={enviando}
          onClick={enviar}
        >
          {enviadoEste ? "Atualizar nota" : ultimo ? "Enviar e concluir" : "Enviar nota"}
        </Button>
      </div>
    </div>
  );
}
