import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Crown, House, Image as ImageIcon, Share2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { TabelaTimes } from "@/components/goating/tabela-times";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { carregarElenco, compartilhar } from "@/lib/placar/dados";
import { FolhaPoster } from "@/components/goating/folha-poster";
import { SeloPremium } from "@/components/goating/selo-premium";
import { usePremiums } from "@/hooks/use-premiums";
import {
  campeoesDoDia,
  corDoTime,
  nomeDoTime,
  tabelaDosTimes,
  textoDoPlacar,
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
  const [folhaPoster, setFolhaPoster] = useState(false);

  const consulta = useQuery({
    queryKey: ["pelada-resumo", id],
    enabled: !!userId,
    queryFn: async () => {
      const [peladaRes, jogosRes, elenco] = await Promise.all([
        supabase
          .from("matches")
          .select(
            "id, titulo, data, crew_id, nomes_times, cores_times, contagem_vitoria, placar_finalizado_em",
          )
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
  // quem é Premium sai com a coroa no resumo e com o nome dourado no pôster
  const premiums = usePremiums(consulta.data?.elenco.map((j) => j.userId) ?? []);

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
      <div className="app-shell flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
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
  const corTime = (time: number) => corDoTime(time, pelada.cores_times);
  const finais: JogoFinal[] = jogos.map((j) => ({
    times: [j.time_a, j.time_b],
    placar: [j.gols_a, j.gols_b],
    vencedor: j.vencedor,
  }));
  const penaltisDe = (j: (typeof jogos)[number]): [number, number] | null =>
    j.penaltis_a !== null && j.penaltis_b !== null ? [j.penaltis_a, j.penaltis_b] : null;
  const nosPenaltis = jogos.flatMap((j) => {
    const penaltis = penaltisDe(j);
    return penaltis ? [{ jogo: j, penaltis }] : [];
  });
  const tabela = tabelaDosTimes(finais);
  const campeoes = campeoesDoDia(tabela);
  const jogoUnico = jogos.length === 1 ? jogos[0] : undefined;
  const artilharia = elenco
    .filter((j) => j.gols > 0)
    .sort((a, b) => b.gols - a.gols || a.nome.localeCompare(b.nome));
  const maisGols = artilharia[0]?.gols ?? 0;
  const ranking = (campo: "assistencias" | "defesas") =>
    elenco
      .filter((j) => j[campo] > 0)
      .sort((a, b) => b[campo] - a[campo] || a.nome.localeCompare(b.nome))
      .map((j) => ({ memberId: j.memberId, nome: j.nome, time: j.time, total: j[campo] }));
  const assistencias = ranking("assistencias");
  const defesas = ranking("defesas");
  const comCartao = elenco.filter((j) => j.amarelos + j.azuis + j.vermelhos > 0);
  const cartoes = {
    amarelos: elenco.reduce((soma, j) => soma + j.amarelos, 0),
    azuis: elenco.reduce((soma, j) => soma + j.azuis, 0),
    vermelhos: elenco.reduce((soma, j) => soma + j.vermelhos, 0),
  };
  const penaltisDoUnico = jogoUnico ? penaltisDe(jogoUnico) : null;
  const dataTexto = new Date(`${pelada.data}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const manchete =
    campeoes.length === 1 && campeoes[0] !== undefined
      ? `${nomeTime(campeoes[0])} ${jogoUnico ? (penaltisDoUnico ? "venceu nos pênaltis" : "venceu") : "foi o campeão do dia"}`
      : "Terminou tudo igual";

  const dadosDoPoster = {
    titulo: pelada.titulo,
    data: dataTexto,
    manchete,
    placar: jogoUnico
      ? {
          timeA: nomeTime(jogoUnico.time_a),
          golsA: jogoUnico.gols_a,
          timeB: nomeTime(jogoUnico.time_b),
          golsB: jogoUnico.gols_b,
          penaltis: penaltisDoUnico,
        }
      : undefined,
    notas: jogoUnico
      ? undefined
      : nosPenaltis.map(
          ({ jogo, penaltis }) =>
            `Jogo ${jogo.ordem} nos pênaltis: ${nomeTime(jogo.time_a)} ${penaltis[0]} × ${penaltis[1]} ${nomeTime(jogo.time_b)}`,
        ),
    destaques: { assistencias, defesas, cartoes },
    tabela: jogoUnico
      ? undefined
      : tabela.map((l) => ({
          nome: nomeTime(l.time),
          vitorias: l.vitorias,
          empates: l.empates,
          derrotas: l.derrotas,
        })),
    artilharia: artilharia.map((j) => ({
      nome: j.nome,
      gols: j.gols,
      premium: !!j.userId && premiums.has(j.userId),
    })),
  };

  async function compartilharResumo() {
    const linhas = [`⚽ ${pelada.titulo} · ${dataTexto}`, ""];
    if (jogoUnico) {
      linhas.push(
        `${nomeTime(jogoUnico.time_a)} ${textoDoPlacar([jogoUnico.gols_a, jogoUnico.gols_b], penaltisDoUnico)} ${nomeTime(jogoUnico.time_b)}`,
      );
    } else {
      linhas.push(`🏆 ${manchete}`, "");
      for (const l of tabela)
        linhas.push(`${nomeTime(l.time)}: ${l.vitorias}V ${l.empates}E ${l.derrotas}D`);
      for (const { jogo, penaltis } of nosPenaltis)
        linhas.push(
          `Jogo ${jogo.ordem} nos pênaltis: ${nomeTime(jogo.time_a)} ${penaltis[0]} × ${penaltis[1]} ${nomeTime(jogo.time_b)}`,
        );
    }
    if (artilharia.length > 0) {
      linhas.push("", "*Artilharia*");
      for (const j of artilharia)
        linhas.push(`${j.gols === maisGols ? "👑" : "•"} ${j.nome}: ${j.gols}`);
    }
    if (assistencias.length > 0) {
      linhas.push("", "*Assistências*");
      for (const j of assistencias) linhas.push(`• ${j.nome}: ${j.total}`);
    }
    if (defesas.length > 0) {
      linhas.push("", "*Defesas épicas*");
      for (const j of defesas) linhas.push(`🧤 ${j.nome}: ${j.total}`);
    }
    if (comCartao.length > 0) {
      linhas.push("", "*Cartões*");
      for (const j of comCartao)
        linhas.push(
          `• ${j.nome}: ${"🟨".repeat(j.amarelos)}${"🟦".repeat(j.azuis)}${"🟥".repeat(j.vermelhos)}`,
        );
    }
    const resultado = await compartilhar(linhas.join("\n"));
    if (resultado === "copiado") toast.success("Resumo copiado. Cola no grupo!");
  }

  return (
    <div className="app-shell flex min-h-dvh flex-col">
      <header className="bg-primary px-4 pt-4 pb-6">
        {/* sem setinha de voltar: a pelada acabou, e voltar cairia no placar ou no sorteio */}
        <span className="text-xs font-semibold tracking-wide text-mint uppercase">
          Resumo da pelada
        </span>
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
        {penaltisDoUnico && (
          <p className="mt-2 text-center text-sm font-bold text-tier-ouro">
            Pênaltis: {penaltisDoUnico[0]} × {penaltisDoUnico[1]}
          </p>
        )}
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
                  <span className="flex min-w-0 flex-1 items-center gap-1">
                    <span className="truncate font-semibold">{j.nome}</span>
                    {j.userId && premiums.has(j.userId) && <SeloPremium />}
                  </span>
                  {j.time !== null && (
                    <span className={cn("text-[10px] font-bold uppercase", corTime(j.time).texto)}>
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

        {(
          [
            ["Assistências", assistencias],
            ["Defesas épicas", defesas],
          ] as const
        ).map(([titulo, lista]) =>
          lista.length > 0 ? (
            <section key={titulo} className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
              <h2 className="mb-1 text-sm font-bold text-foreground">{titulo}</h2>
              <ul className="divide-y divide-border">
                {lista.map((j) => (
                  <li key={j.memberId} className="flex items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-semibold">{j.nome}</span>
                    {j.time !== null && (
                      <span
                        className={cn("text-[10px] font-bold uppercase", corTime(j.time).texto)}
                      >
                        {nomeTime(j.time)}
                      </span>
                    )}
                    <span className="w-8 text-right text-lg font-extrabold tabular-nums">
                      {j.total}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}

        {comCartao.length > 0 && (
          <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
            <h2 className="mb-1 text-sm font-bold text-foreground">Cartões</h2>
            <ul className="divide-y divide-border">
              {comCartao.map((j) => (
                <li key={j.memberId} className="flex items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">{j.nome}</span>
                  <span className="flex shrink-0 gap-1">
                    {(
                      [
                        ["bg-yellow-400", j.amarelos],
                        ["bg-blue-600", j.azuis],
                        ["bg-red-600", j.vermelhos],
                      ] as const
                    ).flatMap(([cor, total]) =>
                      Array.from({ length: total }, (_, i) => (
                        <span key={`${cor}${i}`} className={cn("h-5 w-3.5 rounded-sm", cor)} />
                      )),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!jogoUnico && (
          <TabelaTimes tabela={tabela} nomeTime={nomeTime} cores={pelada.cores_times} />
        )}

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
                      corTime(j.time_a).texto,
                    )}
                  >
                    {nomeTime(j.time_a)}
                  </span>
                  <span className="font-extrabold tabular-nums">
                    {textoDoPlacar([j.gols_a, j.gols_b], penaltisDe(j), true)}
                  </span>
                  <span className={cn("flex-1 truncate font-semibold", corTime(j.time_b).texto)}>
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
          <Button className="flex-[2]" onClick={() => setFolhaPoster(true)}>
            <ImageIcon className="mr-2 size-4" /> Compartilhar pôster
          </Button>
        </div>
        <Button asChild variant="ghost" className="mt-2 w-full">
          <Link to="/" replace>
            <House className="mr-2 size-4" /> Voltar ao início
          </Link>
        </Button>
      </div>

      {folhaPoster && (
        <FolhaPoster
          dados={dadosDoPoster}
          nomeDoArquivo={`goating-${pelada.data}.png`}
          onFechar={() => setFolhaPoster(false)}
        />
      )}
    </div>
  );
}
