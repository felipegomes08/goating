import { useState } from "react";
import { createFileRoute, Link, useParams, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { compartilhar } from "@/lib/placar/dados";

export const Route = createFileRoute("/turma/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Ranking da turma · Goating" }] }),
  component: RankingDaTurma,
});

type Periodo = "mes" | "ano" | "tudo";
type Criterio = "gols" | "vitorias" | "aproveitamento";

const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "mes", rotulo: "Mês" },
  { id: "ano", rotulo: "Ano" },
  { id: "tudo", rotulo: "Tudo" },
];
const CRITERIOS: { id: Criterio; rotulo: string }[] = [
  { id: "gols", rotulo: "Gols" },
  { id: "vitorias", rotulo: "Vitórias" },
  { id: "aproveitamento", rotulo: "Aproveitamento" },
];

function inicioDoPeriodo(periodo: Periodo) {
  const hoje = new Date();
  if (periodo === "tudo") return null;
  const mes = periodo === "mes" ? hoje.getMonth() + 1 : 1;
  return `${hoje.getFullYear()}-${String(mes).padStart(2, "0")}-01`;
}

function RankingDaTurma() {
  const { id } = useParams({ from: "/turma/$id" });
  const { userId, carregando } = useSession();
  const router = useRouter();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [criterio, setCriterio] = useState<Criterio>("gols");

  const turma = useQuery({
    queryKey: ["turma", id],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crews")
        .select("id, nome")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const ranking = useQuery({
    queryKey: ["turma-ranking", id, periodo],
    enabled: !!userId,
    queryFn: async () => {
      const desde = inicioDoPeriodo(periodo);
      const { data, error } = await supabase.rpc("crew_stats", {
        p_crew_id: id,
        ...(desde ? { p_desde: desde } : {}),
      });
      if (error) throw error;
      return data.map((l) => ({
        ...l,
        // 3 pontos por vitória, 1 por empate, sobre o máximo possível
        aproveitamento:
          l.jogos > 0 ? Math.round(((l.vitorias * 3 + l.empates) / (l.jogos * 3)) * 100) : 0,
      }));
    },
  });

  if (carregando || turma.isLoading) {
    return (
      <div className="app-shell space-y-3 p-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }
  if (!turma.data) {
    return (
      <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {userId ? "Essa turma não existe mais." : "Entre na sua conta para ver o ranking."}
        </p>
        <Button asChild>
          <Link to={userId ? "/" : "/auth"}>{userId ? "Voltar ao feed" : "Entrar no Goating"}</Link>
        </Button>
      </div>
    );
  }

  const linhas = [...(ranking.data ?? [])].sort(
    (a, b) =>
      b[criterio] - a[criterio] ||
      b.gols - a.gols ||
      b.vitorias - a.vitorias ||
      a.nome.localeCompare(b.nome),
  );
  const rotuloPeriodo =
    periodo === "mes"
      ? new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : periodo === "ano"
        ? String(new Date().getFullYear())
        : "desde o começo";
  const valor = (l: (typeof linhas)[number]) =>
    criterio === "aproveitamento" ? `${l.aproveitamento}%` : l[criterio];

  async function compartilharRanking() {
    const rotulo = CRITERIOS.find((c) => c.id === criterio)?.rotulo ?? "";
    const medalhas = ["🥇", "🥈", "🥉"];
    const texto = [
      `🏆 ${turma.data?.nome} · ${rotulo} · ${rotuloPeriodo}`,
      "",
      ...linhas.slice(0, 10).map((l, i) => `${medalhas[i] ?? `${i + 1}.`} ${l.nome}: ${valor(l)}`),
    ].join("\n");
    const resultado = await compartilhar(texto);
    if (resultado === "copiado") toast.success("Ranking copiado. Cola no grupo!");
  }

  return (
    <div className="app-shell flex min-h-screen flex-col pb-28">
      <header className="bg-primary px-4 pt-4 pb-5">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Voltar" onClick={() => router.history.back()}>
            <ArrowLeft className="size-5 text-primary-foreground" />
          </button>
          <span className="text-xs font-semibold tracking-wide text-mint uppercase">
            Ranking da turma
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-primary-foreground">{turma.data.nome}</h1>
        <p className="mt-1 text-sm text-mint capitalize">{rotuloPeriodo}</p>
      </header>

      <div className="space-y-3 p-4">
        <Abas opcoes={PERIODOS} valor={periodo} onMudar={setPeriodo} />
        <Abas opcoes={CRITERIOS} valor={criterio} onMudar={setCriterio} />

        {ranking.isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : linhas.length === 0 ? (
          <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            Nenhuma pelada com placar nesse período ainda.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-2xl bg-card shadow-[var(--shadow-card)]">
            {linhas.map((l, i) => {
              const corpo = (
                <>
                  <span
                    className={cn(
                      "w-6 text-center text-sm font-extrabold",
                      i === 0 ? "text-tier-ouro" : "text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {l.nome}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {l.peladas} {l.peladas === 1 ? "pelada" : "peladas"} · {l.vitorias}V{" "}
                      {l.empates}E {l.derrotas}D · {l.gols} {l.gols === 1 ? "gol" : "gols"}
                    </span>
                  </span>
                  <span className="text-xl font-extrabold text-foreground tabular-nums">
                    {valor(l)}
                  </span>
                </>
              );
              return l.user_id ? (
                <Link
                  key={l.member_id}
                  to="/jogador/$id"
                  params={{ id: l.user_id }}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  {corpo}
                </Link>
              ) : (
                <div key={l.member_id} className="flex items-center gap-3 px-3 py-2.5">
                  {corpo}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {linhas.length > 0 && (
        <div className="sticky bottom-0 mt-auto border-t border-border bg-card p-4">
          <Button className="w-full" onClick={compartilharRanking}>
            <Share2 className="mr-2 size-4" /> Compartilhar ranking
          </Button>
        </div>
      )}
    </div>
  );
}

function Abas<T extends string>({
  opcoes,
  valor,
  onMudar,
}: {
  opcoes: { id: T; rotulo: string }[];
  valor: T;
  onMudar: (valor: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-secondary p-1">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={valor === o.id}
          onClick={() => onMudar(o.id)}
          className={cn(
            "flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors",
            valor === o.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
