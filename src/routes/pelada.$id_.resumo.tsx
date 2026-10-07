import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Crown, Image as ImageIcon, Share2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useVoltar } from "@/hooks/use-voltar";
import { TabelaTimes } from "@/components/goating/tabela-times";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { carregarElenco, compartilhar } from "@/lib/placar/dados";
import { compartilharPoster } from "@/lib/placar/poster";
import {
  campeoesDoDia,
  corDoTime,
  nomeDoTime,
  tabelaDosTimes,
  type JogoFinal,
} from "@/lib/placar/estado";

export const Route = createFileRoute("/pelada/$id_/resumo")({
  ssr: false,
  head: () => ({ meta: [{ title: "Resumo da pelada · Goating" }] }),
  component: ResumoDaPelada,
});

function ResumoDaPelada() {
  const { id } = useParams({ from: "/pelada/$id_/resumo" });
  const { userId, carregando } = useSession();
  const navigate = useNavigate();
  const [gerandoPoster, setGerandoPoster] = useState(false);
  const voltar = useVoltar(() => void navigate({ to: "/pelada/$id", params: { id } }));

  const consulta = useQuery({
    queryKey: ["pelada-resumo", id],
    enabled: !!userId,
    queryFn: async () => {
      const [peladaRes, jogosRes, elenco] = await Promise.all([
        supabase
          .from("matches")
          .select("id, titulo, data, crew_id, nomes_times, contagem_vitoria, placar_finalizado_em")
          .eq("id", id)
          .maybeSingle(),
        supabase.from("games").select("*").eq("match_id", id).order("ordem"),
        carregarElenco(id),
      ]);
      if (peladaRes.error) throw peladaRes.error;
      if (jogosRes.error) throw jogosRes.error;
      return peladaRes.data ? { pelada: peladaRes.data, jogos: jogosRes.data, elenco } : null;
    },
  });

  if (carregando || consulta.isLoading) {
    return (
      <div className="app-shell space-y-3 p-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const dados = consulta.data;
  if (!dados || !dados.pelada.placar_finalizado_em || dados.jogos.length === 0) {
    return (
      <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {userId
            ? "Essa pelada ainda não tem placar finalizado."
            : "Entre na sua conta para ver o resumo."}
        </p>
        <Button asChild>
          {userId ? (
            <Link to="/pelada/$id" params={{ id }}>
              Voltar pra pelada
            </Link>
          ) : (
            <Link to="/auth">Entrar no Goating</Link>
          )}
        </Button>
      </div>
    );
  }

  const { pelada, jogos, elenco } = dados;
  const nomeTime = (time: number) => nomeDoTime(pelada.nomes_times, time);
  const finais: JogoFinal[] = jogos.map((j) => ({
    times: [j.time_a, j.time_b],
    placar: [j.gols_a, j.gols_b],
    vencedor: j.vencedor,
  }));
  const tabela = tabelaDosTimes(finais);
  const campeoes = campeoesDoDia(tabela);
  const jogoUnico = jogos.length === 1 ? jogos[0] : undefined;
  const artilharia = elenco
    .filter((j) => j.gols > 0)
    .sort((a, b) => b.gols - a.gols || a.nome.localeCompare(b.nome));
  const maisGols = artilharia[0]?.gols ?? 0;
  const dataTexto = new Date(`${pelada.data}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const manchete =
    campeoes.length === 1 && campeoes[0] !== undefined
      ? `${nomeTime(campeoes[0])} ${jogoUnico ? "venceu" : "foi o campeão do dia"}`
      : "Terminou tudo igual";

  async function compartilharImagem() {
    setGerandoPoster(true);
    try {
      const resultado = await compartilharPoster(
        {
          titulo: pelada.titulo,
          data: dataTexto,
          manchete,
          placar: jogoUnico
            ? {
                timeA: nomeTime(jogoUnico.time_a),
                golsA: jogoUnico.gols_a,
                timeB: nomeTime(jogoUnico.time_b),
                golsB: jogoUnico.gols_b,
              }
            : undefined,
          tabela: jogoUnico
            ? undefined
            : tabela.map((l) => ({
                nome: nomeTime(l.time),
                vitorias: l.vitorias,
                empates: l.empates,
                derrotas: l.derrotas,
              })),
          artilharia: artilharia.map((j) => ({ nome: j.nome, gols: j.gols })),
        },
        `goating-${pelada.data}.png`,
      );
      if (resultado === "baixado") toast.success("Pôster baixado. Manda no grupo!");
    } catch {
      toast.error("Não deu pra gerar o pôster.");
    } finally {
      setGerandoPoster(false);
    }
  }

  async function compartilharResumo() {
    const linhas = [`⚽ ${pelada.titulo} · ${dataTexto}`, ""];
    if (jogoUnico) {
      linhas.push(
        `${nomeTime(jogoUnico.time_a)} ${jogoUnico.gols_a} × ${jogoUnico.gols_b} ${nomeTime(jogoUnico.time_b)}`,
      );
    } else {
      linhas.push(`🏆 ${manchete}`, "");
      for (const l of tabela)
        linhas.push(`${nomeTime(l.time)}: ${l.vitorias}V ${l.empates}E ${l.derrotas}D`);
    }
    if (artilharia.length > 0) {
      linhas.push("", "*Artilharia*");
      for (const j of artilharia)
        linhas.push(`${j.gols === maisGols ? "👑" : "•"} ${j.nome}: ${j.gols}`);
    }
    const resultado = await compartilhar(linhas.join("\n"));
    if (resultado === "copiado") toast.success("Resumo copiado. Cola no grupo!");
  }

  return (
    <div className="app-shell flex min-h-screen flex-col pb-28">
      <header className="bg-primary px-4 pt-4 pb-6">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Voltar" onClick={voltar}>
            <ArrowLeft className="size-5 text-primary-foreground" />
          </button>
          <span className="text-xs font-semibold tracking-wide text-mint uppercase">
            Resumo da pelada
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-primary-foreground">{pelada.titulo}</h1>
        <p className="mt-1 text-sm text-mint capitalize">{dataTexto}</p>

        {jogoUnico ? (
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center text-primary-foreground">
            <div>
              <p className="truncate text-sm font-bold uppercase">{nomeTime(jogoUnico.time_a)}</p>
              <p className="text-6xl leading-none font-black tabular-nums">{jogoUnico.gols_a}</p>
            </div>
            <span className="text-2xl font-bold text-mint">×</span>
            <div>
              <p className="truncate text-sm font-bold uppercase">{nomeTime(jogoUnico.time_b)}</p>
              <p className="text-6xl leading-none font-black tabular-nums">{jogoUnico.gols_b}</p>
            </div>
          </div>
        ) : null}
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-base font-extrabold text-primary-foreground">
          <Trophy className="size-5 text-tier-ouro" /> {manchete}
        </p>
      </header>

      <div className="space-y-4 p-4">
        <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-1 text-sm font-bold text-foreground">Artilharia</h2>
          {artilharia.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguém marcou (ou os gols ficaram sem autor).
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {artilharia.map((j) => (
                <li key={j.memberId} className="flex items-center gap-2 py-2 text-sm">
                  {j.gols === maisGols ? (
                    <Crown className="size-4 shrink-0 text-tier-ouro" />
                  ) : (
                    <span className="size-4 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-semibold">{j.nome}</span>
                  {j.time !== null && (
                    <span
                      className={cn("text-[10px] font-bold uppercase", corDoTime(j.time).texto)}
                    >
                      {nomeTime(j.time)}
                    </span>
                  )}
                  <span className="w-8 text-right text-lg font-extrabold tabular-nums">
                    {j.gols}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!jogoUnico && <TabelaTimes tabela={tabela} nomeTime={nomeTime} />}

        {!jogoUnico && (
          <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
            <h2 className="mb-1 text-sm font-bold text-foreground">Jogos ({jogos.length})</h2>
            <ul className="divide-y divide-border">
              {jogos.map((j) => (
                <li key={j.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="w-5 text-xs font-bold text-muted-foreground">{j.ordem}</span>
                  <span
                    className={cn(
                      "flex-1 truncate text-right font-semibold",
                      corDoTime(j.time_a).texto,
                    )}
                  >
                    {nomeTime(j.time_a)}
                  </span>
                  <span className="font-extrabold tabular-nums">
                    {j.gols_a} × {j.gols_b}
                  </span>
                  <span className={cn("flex-1 truncate font-semibold", corDoTime(j.time_b).texto)}>
                    {nomeTime(j.time_b)}
                  </span>
                </li>
              ))}
            </ul>
            {pelada.contagem_vitoria === "por_dia" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Nessa pelada a vitória individual vale pelo resultado do dia: só o time campeão
                leva.
              </p>
            )}
          </section>
        )}

        {pelada.crew_id && (
          <Button asChild variant="outline" className="w-full">
            <Link to="/turma/$id" params={{ id: pelada.crew_id }}>
              <Trophy className="mr-2 size-4" /> Ver ranking da turma
            </Link>
          </Button>
        )}
      </div>

      <div className="sticky bottom-0 mt-auto border-t border-border bg-card p-4">
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={compartilharResumo}>
            <Share2 className="mr-2 size-4" /> Texto
          </Button>
          <Button className="flex-[2]" disabled={gerandoPoster} onClick={compartilharImagem}>
            <ImageIcon className="mr-2 size-4" />{" "}
            {gerandoPoster ? "Gerando…" : "Compartilhar pôster"}
          </Button>
        </div>
      </div>
    </div>
  );
}
