import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Flag, Pause, Play, RotateCcw, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useSession } from "@/hooks/use-session";
import { useVoltar } from "@/hooks/use-voltar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  liberarAudio,
  manterTelaLigada,
  pararAlarme,
  tocarAlarme,
  vibrar,
} from "@/lib/placar/alarme";
import { TabelaTimes } from "@/components/goating/tabela-times";
import { carregarElenco, podeGerirPelada, type LinhaElenco } from "@/lib/placar/dados";
import {
  corDoTime,
  decorridoMs,
  ehEstadoPlacar,
  estadoVazio,
  filaDeEspera,
  formatarRelogio,
  jogoAtual,
  jogoFinal,
  montarPayload,
  nomeDoTime,
  placarDoJogo,
  saldoDosJogadores,
  sugerirProximo,
  tabelaDosTimes,
  type Contagem,
  type EstadoPlacar,
  type Jogo,
  type Lado,
} from "@/lib/placar/estado";

export const Route = createFileRoute("/pelada/$id_/placar")({
  ssr: false,
  head: () => ({ meta: [{ title: "Placar · Goating" }] }),
  component: PlacarDaPelada,
});

const chaveLocal = (id: string) => `goating-placar-${id}`;

function lerLocal(id: string): EstadoPlacar | null {
  try {
    const salvo: unknown = JSON.parse(localStorage.getItem(chaveLocal(id)) ?? "null");
    return ehEstadoPlacar(salvo) ? salvo : null;
  } catch {
    return null;
  }
}

function PlacarDaPelada() {
  const { id } = useParams({ from: "/pelada/$id_/placar" });
  const { userId, carregando } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const voltar = useVoltar(() => void navigate({ to: "/pelada/$id", params: { id } }));

  const consulta = useQuery({
    queryKey: ["placar", id, userId],
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: 0,
    queryFn: async () => {
      const { data: pelada, error } = await supabase
        .from("matches")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!pelada) return null;
      const [elenco, podeGerir] = await Promise.all([
        carregarElenco(id),
        podeGerirPelada(pelada, userId!),
      ]);
      return { pelada, elenco, podeGerir };
    },
  });

  const [estado, setEstado] = useState<EstadoPlacar | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [alarme, setAlarme] = useState(false);
  const [proximo, setProximo] = useState<[number, number] | null>(null);
  const [folha, setFolha] = useState<
    | { tipo: "encerrar" }
    | { tipo: "autor"; golId: string }
    | { tipo: "reforco"; lado: Lado }
    | { tipo: "finalizar" }
    | null
  >(null);
  const [salvando, setSalvando] = useState(false);
  const ultimoToque = useRefDeToque();

  const dados = consulta.data;
  const souOrganizador = !!dados?.podeGerir;

  // O aparelho é a fonte da verdade durante o jogo (quadra costuma ter sinal ruim);
  // o banco guarda uma cópia pra recuperar se trocar de aparelho.
  useEffect(() => {
    if (!dados || estado) return;
    const doBanco = ehEstadoPlacar(dados.pelada.placar_estado) ? dados.pelada.placar_estado : null;
    setEstado(lerLocal(id) ?? doBanco ?? estadoVazio());
  }, [dados, estado, id]);

  const sincronizado = useRef<string | null>(null);
  useEffect(() => {
    if (!estado || !souOrganizador) return;
    const texto = JSON.stringify(estado);
    try {
      localStorage.setItem(chaveLocal(id), texto);
    } catch {
      // armazenamento cheio ou bloqueado: segue só na memória e na cópia do banco
    }
    if (sincronizado.current === null) {
      sincronizado.current = texto;
      return;
    }
    if (sincronizado.current === texto) return;
    const espera = setTimeout(() => {
      void supabase
        .from("matches")
        .update({ placar_estado: estado as unknown as Json })
        .eq("id", id)
        .then(({ error }) => {
          if (!error) sincronizado.current = texto;
        });
    }, 2000);
    return () => clearTimeout(espera);
  }, [estado, id, souOrganizador]);

  const atual = estado ? jogoAtual(estado) : null;
  const rodando = !!atual?.iniciadoEm;
  const limiteMs = (dados?.pelada.minutos_tempo ?? 30) * 60_000;

  useEffect(() => {
    if (!rodando) return;
    void manterTelaLigada();
    const tique = setInterval(() => setAgora(Date.now()), 250);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void manterTelaLigada();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(tique);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [rodando]);

  // Acabou o tempo: apita até alguém parar.
  useEffect(() => {
    if (!atual || !rodando || atual.alarmado || decorridoMs(atual, agora) < limiteMs) return;
    mudarAtual((j) => ({ ...j, alarmado: true }));
    tocarAlarme();
    setAlarme(true);
  }, [atual, rodando, agora, limiteMs]);

  useEffect(() => () => pararAlarme(), []);

  if (carregando || consulta.isLoading || (dados && !estado)) {
    return (
      <div className="app-shell space-y-3 p-4">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }
  if (!dados || !estado || !souOrganizador) {
    return (
      <div className="app-shell flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {consulta.isError
            ? "Não conseguimos carregar o placar."
            : dados
              ? "Só o organizador ou um administrador da turma marca o placar."
              : "Essa pelada não existe mais."}
        </p>
        <Button asChild>
          <Link to="/pelada/$id" params={{ id }}>
            Voltar pra pelada
          </Link>
        </Button>
      </div>
    );
  }

  const { pelada, elenco } = dados;
  const numTimes = pelada.num_times;
  const nomeTime = (time: number) => nomeDoTime(pelada.nomes_times, time);
  const nomeJogador = (memberId: string | null) =>
    memberId
      ? (elenco.find((j) => j.memberId === memberId)?.nome ?? "Jogador")
      : "Sem autor / contra";
  const encerrados = estado.jogos.filter((j) => j.encerrado);

  function mudarAtual(fn: (jogo: Jogo) => Jogo) {
    setEstado((e) => {
      if (!e) return e;
      const ultimo = e.jogos.at(-1);
      if (!ultimo || ultimo.encerrado) return e;
      return { ...e, jogos: [...e.jogos.slice(0, -1), fn(ultimo)] };
    });
  }

  function silenciar() {
    pararAlarme();
    setAlarme(false);
  }

  function iniciarJogo(times: [number, number]) {
    liberarAudio();
    const lados: [string[], string[]] = [
      elenco.filter((j) => j.time === times[0]).map((j) => j.memberId),
      elenco.filter((j) => j.time === times[1]).map((j) => j.memberId),
    ];
    if (lados[0].length === 0 || lados[1].length === 0) {
      toast.error("Um dos times está sem jogador. Ajusta em “Editar times”.");
      return;
    }
    setEstado((e) => ({
      v: 1,
      jogos: [
        ...(e?.jogos ?? []),
        {
          id: crypto.randomUUID(),
          times,
          lados,
          gols: [],
          tempo: 1,
          acumuladoMs: 0,
          iniciadoEm: null,
          alarmado: false,
          duracaoMs: 0,
          encerrado: false,
          vencedor: null,
        },
      ],
    }));
    setProximo(null);
    if (pelada.status === "agendada") {
      // tira a pelada do feed e fecha a entrada de gente nova enquanto a bola rola
      void supabase
        .from("matches")
        .update({ status: "em_andamento" })
        .eq("id", id)
        .eq("status", "agendada");
    }
    window.scrollTo({ top: 0 });
  }

  function alternarRelogio() {
    liberarAudio();
    silenciar();
    mudarAtual((j) =>
      j.iniciadoEm
        ? { ...j, acumuladoMs: decorridoMs(j), iniciadoEm: null }
        : { ...j, iniciadoEm: Date.now() },
    );
    setAgora(Date.now());
  }

  function proximoTempo() {
    silenciar();
    mudarAtual((j) => ({
      ...j,
      tempo: j.tempo + 1,
      duracaoMs: j.duracaoMs + decorridoMs(j),
      acumuladoMs: 0,
      iniciadoEm: null,
      alarmado: false,
    }));
  }

  function marcarGol(lado: Lado, memberId: string | null) {
    if (!atual || !ultimoToque()) return;
    const golId = crypto.randomUUID();
    const [a, b] = placarDoJogo(atual);
    const novoPlacar: [number, number] = lado === 0 ? [a + 1, b] : [a, b + 1];
    mudarAtual((j) => ({
      ...j,
      gols: [
        ...j.gols,
        {
          id: golId,
          lado,
          memberId,
          tempo: j.tempo,
          minuto: Math.floor(decorridoMs(j) / 60_000) + 1,
        },
      ],
    }));
    vibrar(80);
    toast(`Gol de ${nomeJogador(memberId)}`, {
      description: `${nomeTime(atual.times[0])} ${novoPlacar[0]} × ${novoPlacar[1]} ${nomeTime(atual.times[1])}`,
      duration: 9000,
      action: { label: "Desfazer", onClick: () => apagarGol(golId) },
    });
    if (pelada.gols_limite && novoPlacar[lado] >= pelada.gols_limite)
      setFolha({ tipo: "encerrar" });
  }

  function apagarGol(golId: string) {
    mudarAtual((j) => ({ ...j, gols: j.gols.filter((g) => g.id !== golId) }));
  }

  function trocarAutor(golId: string, lado: Lado, memberId: string | null) {
    mudarAtual((j) => ({
      ...j,
      gols: j.gols.map((g) => (g.id === golId ? { ...g, lado, memberId } : g)),
    }));
    setFolha(null);
  }

  function reforcar(lado: Lado, memberId: string) {
    mudarAtual((j) => {
      const lados: [string[], string[]] = [
        j.lados[0].filter((m) => m !== memberId),
        j.lados[1].filter((m) => m !== memberId),
      ];
      lados[lado] = [...lados[lado], memberId];
      return { ...j, lados };
    });
    setFolha(null);
  }

  function encerrarJogo(vencedor: Lado | null) {
    silenciar();
    mudarAtual((j) => ({
      ...j,
      duracaoMs: j.duracaoMs + decorridoMs(j),
      acumuladoMs: 0,
      iniciadoEm: null,
      encerrado: true,
      vencedor,
    }));
    setFolha(null);
    window.scrollTo({ top: 0 });
  }

  function reabrirUltimo() {
    setEstado((e) => {
      const ultimo = e?.jogos.at(-1);
      if (!e || !ultimo?.encerrado) return e;
      return {
        ...e,
        jogos: [...e.jogos.slice(0, -1), { ...ultimo, encerrado: false, vencedor: null }],
      };
    });
  }

  async function finalizarPelada() {
    if (!estado) return;
    setSalvando(true);
    const contagem: Contagem = pelada.contagem_vitoria === "por_dia" ? "por_dia" : "por_jogo";
    const { error: erroCopia } = await supabase
      .from("matches")
      .update({ placar_estado: estado as unknown as Json })
      .eq("id", id);
    const { error } = erroCopia
      ? { error: erroCopia }
      : await supabase.rpc("salvar_placar", {
          p_match_id: id,
          p_payload: montarPayload(estado, contagem) as unknown as Json,
        });
    setSalvando(false);
    if (error) {
      toast.error(
        "Não deu pra salvar. O placar continua guardado no aparelho — tenta de novo com internet.",
      );
      return;
    }
    try {
      localStorage.removeItem(chaveLocal(id));
    } catch {
      // sem acesso ao armazenamento: nada a limpar
    }
    await queryClient.invalidateQueries({ queryKey: ["pelada", id] });
    await navigate({ to: "/pelada/$id/resumo", params: { id }, replace: true });
  }

  const cabecalho = (
    <header className="flex items-center gap-3 bg-primary px-4 py-3">
      <button type="button" aria-label="Voltar" onClick={voltar}>
        <ArrowLeft className="size-5 text-primary-foreground" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-base font-extrabold text-primary-foreground">
        {pelada.titulo}
      </h1>
      <Link
        to="/pelada/$id/times"
        params={{ id }}
        className="flex items-center gap-1 text-xs font-semibold text-mint"
      >
        <Users className="size-4" /> Editar times
      </Link>
    </header>
  );

  // ───────────── Entre um jogo e outro ─────────────
  if (!atual) {
    const sugestao = sugerirProximo(estado, numTimes);
    const confronto = proximo ?? sugestao;
    const fila = filaDeEspera(estado, numTimes, confronto);
    const tabela = tabelaDosTimes(encerrados.map(jogoFinal));
    const artilharia = saldoDosJogadores(estado, "por_jogo")
      .filter((l) => l.gols > 0)
      .sort((a, b) => b.gols - a.gols);
    const ultimo = encerrados.at(-1);

    return (
      <div className="app-shell flex min-h-dvh flex-col pb-28">
        {cabecalho}
        <div className="space-y-4 p-4">
          <section className="space-y-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
            <h2 className="text-sm font-bold text-foreground">
              {encerrados.length === 0 ? "Primeiro jogo" : `Jogo ${encerrados.length + 1}`}
            </h2>
            {numTimes > 2 ? (
              ([0, 1] as const).map((lado) => (
                <div key={lado}>
                  <p className="mb-1 text-[11px] font-semibold text-muted-foreground uppercase">
                    {lado === 0 ? "De um lado" : "Do outro"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: numTimes }, (_, t) => {
                      const cor = corDoTime(t);
                      const ativo = confronto[lado] === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          aria-pressed={ativo}
                          disabled={confronto[lado === 0 ? 1 : 0] === t}
                          onClick={() =>
                            setProximo(lado === 0 ? [t, confronto[1]] : [confronto[0], t])
                          }
                          className={cn(
                            "rounded-full border-2 px-3 py-1.5 text-xs font-bold disabled:opacity-30",
                            cor.borda,
                            ativo ? cn(cor.solido, "text-white") : cn(cor.fundo, cor.texto),
                          )}
                        >
                          {nomeTime(t)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-lg font-extrabold text-foreground">
                <span className={corDoTime(confronto[0]).texto}>{nomeTime(confronto[0])}</span>
                <span className="mx-2 text-muted-foreground">×</span>
                <span className={corDoTime(confronto[1]).texto}>{nomeTime(confronto[1])}</span>
              </p>
            )}
            {fila.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Na espera: {fila.map(nomeTime).join(", ")}
              </p>
            )}
            <Button className="w-full" onClick={() => iniciarJogo(confronto)}>
              <Play className="mr-2 size-4" /> Começar jogo
            </Button>
          </section>

          {ultimo && (
            <section className="space-y-2 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-foreground">Jogos de hoje</h2>
                <button
                  type="button"
                  onClick={reabrirUltimo}
                  className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"
                >
                  <RotateCcw className="size-3.5" /> Reabrir o último
                </button>
              </div>
              <ul className="divide-y divide-border">
                {encerrados.map((j, i) => {
                  const [a, b] = placarDoJogo(j);
                  return (
                    <li key={j.id} className="flex items-center gap-2 py-2 text-sm">
                      <span className="w-5 text-xs font-bold text-muted-foreground">{i + 1}</span>
                      <span
                        className={cn(
                          "flex-1 truncate text-right font-semibold",
                          corDoTime(j.times[0]).texto,
                        )}
                      >
                        {nomeTime(j.times[0])}
                      </span>
                      <span className="font-extrabold tabular-nums">
                        {a} × {b}
                      </span>
                      <span
                        className={cn("flex-1 truncate font-semibold", corDoTime(j.times[1]).texto)}
                      >
                        {nomeTime(j.times[1])}
                      </span>
                      <span className="w-12 truncate text-right text-[10px] font-bold text-muted-foreground">
                        {j.vencedor === null ? "empate" : a === b ? "pênaltis" : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {tabela.length > 2 && <TabelaTimes tabela={tabela} nomeTime={nomeTime} />}

          {artilharia.length > 0 && (
            <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
              <h2 className="mb-1 text-sm font-bold text-foreground">Artilharia do dia</h2>
              <ul className="divide-y divide-border">
                {artilharia.map((l, i) => (
                  <li key={l.memberId} className="flex items-center gap-2 py-2 text-sm">
                    <span className="w-5 text-xs font-bold text-muted-foreground">{i + 1}</span>
                    <span className="flex-1 truncate font-semibold">{nomeJogador(l.memberId)}</span>
                    <span className="text-lg font-extrabold tabular-nums">{l.gols}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {encerrados.length > 0 && (
          <div className="sticky bottom-0 mt-auto border-t border-border bg-card p-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setFolha({ tipo: "finalizar" })}
            >
              <Flag className="mr-2 size-4" /> Finalizar pelada
            </Button>
          </div>
        )}

        {folha?.tipo === "finalizar" && (
          <Folha titulo="Finalizar a pelada?" onFechar={() => setFolha(null)}>
            <p className="text-sm text-muted-foreground">
              Salva {encerrados.length} {encerrados.length === 1 ? "jogo" : "jogos"} nas
              estatísticas da turma e abre as avaliações por 24h.
            </p>
            <Button className="w-full" disabled={salvando} onClick={finalizarPelada}>
              {salvando ? "Salvando…" : "Finalizar e ver o resumo"}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setFolha(null)}>
              Ainda tem jogo
            </Button>
          </Folha>
        )}
      </div>
    );
  }

  // ───────────── Bola rolando ─────────────
  const ms = decorridoMs(atual, agora);
  const estourou = ms >= limiteMs;
  const [golsA, golsB] = placarDoJogo(atual);
  const ultimoTempo = atual.tempo >= pelada.tempos;
  const foraDoJogo = elenco.filter(
    (j) => !atual.lados[0].includes(j.memberId) && !atual.lados[1].includes(j.memberId),
  );
  const golEmEdicao =
    folha?.tipo === "autor" ? atual.gols.find((g) => g.id === folha.golId) : undefined;

  return (
    <div className="app-shell flex min-h-dvh flex-col pb-32">
      {cabecalho}
      <div className="space-y-4 p-4">
        <section className="space-y-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground uppercase">
              Jogo {estado.jogos.length} · {atual.tempo}º tempo
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">
              {pelada.minutos_tempo} min{pelada.gols_limite ? ` ou ${pelada.gols_limite} gols` : ""}
            </span>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
            {([0, 1] as const).map((lado) => (
              <div
                key={lado}
                className={cn(corDoTime(atual.times[lado]).texto, lado === 1 && "order-3")}
              >
                <p className="truncate text-sm font-extrabold uppercase">
                  {nomeTime(atual.times[lado])}
                </p>
                <p className="text-7xl leading-none font-black tabular-nums">
                  {lado === 0 ? golsA : golsB}
                </p>
              </div>
            ))}
            <span className="order-2 text-3xl font-bold text-muted-foreground">×</span>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div
              className={cn(
                "flex flex-col items-center justify-center rounded-2xl py-2",
                estourou ? "bg-destructive/10" : "bg-secondary/60",
              )}
            >
              <span className="text-5xl leading-none font-extrabold tabular-nums">
                {formatarRelogio(Math.min(ms, limiteMs))}
              </span>
              {estourou && (
                <span className="text-lg font-bold text-destructive tabular-nums">
                  +{formatarRelogio(ms - limiteMs)}
                </span>
              )}
              <span className="mt-1 text-[11px] font-semibold text-muted-foreground uppercase">
                {rodando ? (estourou ? "Acréscimo" : "Rolando") : ms > 0 ? "Pausado" : "Pronto"}
              </span>
            </div>
            <div className="flex w-36 flex-col gap-2">
              <Button className="flex-1" onClick={alternarRelogio}>
                {rodando ? (
                  <>
                    <Pause className="mr-1 size-4" /> Pausar
                  </>
                ) : (
                  <>
                    <Play className="mr-1 size-4" />{" "}
                    {ms > 0 ? "Continuar" : `Iniciar ${atual.tempo}º T`}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => (ultimoTempo ? setFolha({ tipo: "encerrar" }) : proximoTempo())}
              >
                {ultimoTempo ? "Encerrar jogo" : `Ir p/ ${atual.tempo + 1}º T`}
              </Button>
            </div>
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs text-muted-foreground">Toque no nome de quem fez o gol.</p>
          <div className="grid grid-cols-2 gap-3">
            {([0, 1] as const).map((lado) => {
              const cor = corDoTime(atual.times[lado]);
              return (
                <div key={lado} className="min-w-0 space-y-2">
                  <p
                    className={cn(
                      "truncate border-b-4 pb-1 text-sm font-extrabold uppercase",
                      cor.texto,
                      cor.borda,
                    )}
                  >
                    {nomeTime(atual.times[lado])}
                  </p>
                  {atual.lados[lado].map((memberId) => {
                    const gols = atual.gols.filter(
                      (g) => g.lado === lado && g.memberId === memberId,
                    ).length;
                    return (
                      <button
                        key={memberId}
                        type="button"
                        onClick={() => marcarGol(lado, memberId)}
                        className={cn(
                          "flex min-h-14 w-full items-center justify-between gap-1 rounded-xl border-2 px-3 py-3 text-left font-semibold text-foreground active:scale-[0.97]",
                          cor.fundo,
                          cor.borda,
                        )}
                      >
                        <span className="min-w-0 break-words">{nomeJogador(memberId)}</span>
                        {gols > 0 && (
                          <span
                            className={cn(
                              "min-w-7 shrink-0 rounded-full px-1.5 text-center text-lg font-black text-white tabular-nums",
                              cor.solido,
                            )}
                          >
                            {gols}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => marcarGol(lado, null)}
                    className={cn(
                      "w-full rounded-xl border border-dashed py-2.5 text-xs font-bold",
                      cor.borda,
                      cor.texto,
                    )}
                  >
                    + Gol sem autor / contra
                  </button>
                  <button
                    type="button"
                    onClick={() => setFolha({ tipo: "reforco", lado })}
                    className="w-full rounded-xl border border-border py-2 text-xs font-semibold text-muted-foreground"
                  >
                    + Entrou alguém
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {atual.gols.length > 0 && (
          <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
            <h2 className="mb-1 text-sm font-bold text-foreground">Gols</h2>
            <ul className="divide-y divide-border">
              {[...atual.gols].reverse().map((g) => (
                <li key={g.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="w-10 font-extrabold tabular-nums">
                    {g.minuto}'
                    <span className="block text-[10px] font-medium text-muted-foreground">
                      {g.tempo}º T
                    </span>
                  </span>
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      corDoTime(atual.times[g.lado]).solido,
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {nomeJogador(g.memberId)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFolha({ tipo: "autor", golId: g.id })}
                    className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                  >
                    Trocar
                  </button>
                  <button
                    type="button"
                    onClick={() => apagarGol(g.id)}
                    className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                  >
                    Apagar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {alarme && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center p-4">
          <button
            type="button"
            onClick={silenciar}
            className="w-full max-w-[448px] animate-pulse rounded-2xl bg-destructive py-6 text-xl font-black text-destructive-foreground uppercase shadow-[var(--shadow-float)]"
          >
            Fim do {atual.tempo}º tempo · Parar alarme
          </button>
        </div>
      )}

      {folha?.tipo === "encerrar" && (
        <Folha
          titulo={`${nomeTime(atual.times[0])} ${golsA} × ${golsB} ${nomeTime(atual.times[1])}`}
          onFechar={() => setFolha(null)}
        >
          {golsA === golsB ? (
            <>
              <p className="text-sm text-muted-foreground">Terminou empatado. Quem levou?</p>
              {([0, 1] as const).map((lado) => (
                <Button key={lado} className="w-full" onClick={() => encerrarJogo(lado)}>
                  {nomeTime(atual.times[lado])} venceu
                </Button>
              ))}
              <Button variant="outline" className="w-full" onClick={() => encerrarJogo(null)}>
                Ficou no empate
              </Button>
            </>
          ) : (
            <Button className="w-full" onClick={() => encerrarJogo(golsA > golsB ? 0 : 1)}>
              Encerrar jogo · {nomeTime(atual.times[golsA > golsB ? 0 : 1])} venceu
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={() => setFolha(null)}>
            Voltar pro jogo
          </Button>
        </Folha>
      )}

      {golEmEdicao && (
        <Folha
          titulo={`Quem fez o gol dos ${golEmEdicao.minuto}'?`}
          onFechar={() => setFolha(null)}
        >
          <div className="grid grid-cols-2 gap-3">
            {([0, 1] as const).map((lado) => {
              const cor = corDoTime(atual.times[lado]);
              return (
                <div key={lado} className="min-w-0 space-y-1.5">
                  <p className={cn("truncate text-xs font-extrabold uppercase", cor.texto)}>
                    {nomeTime(atual.times[lado])}
                  </p>
                  {atual.lados[lado].map((memberId) => (
                    <button
                      key={memberId}
                      type="button"
                      onClick={() => trocarAutor(golEmEdicao.id, lado, memberId)}
                      className={cn(
                        "w-full rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold",
                        cor.borda,
                        golEmEdicao.lado === lado && golEmEdicao.memberId === memberId
                          ? cn(cor.solido, "text-white")
                          : cn(cor.fundo, "text-foreground"),
                      )}
                    >
                      {nomeJogador(memberId)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => trocarAutor(golEmEdicao.id, lado, null)}
                    className={cn(
                      "w-full rounded-xl border border-dashed py-2 text-xs font-bold",
                      cor.borda,
                      cor.texto,
                    )}
                  >
                    Sem autor / contra
                  </button>
                </div>
              );
            })}
          </div>
        </Folha>
      )}

      {folha?.tipo === "reforco" && (
        <Folha
          titulo={`Quem entrou no ${nomeTime(atual.times[folha.lado])}?`}
          onFechar={() => setFolha(null)}
        >
          {foraDoJogo.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todo mundo do elenco já está nesse jogo. Chegou gente nova? Adiciona em “Editar
              times”.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {foraDoJogo.map((j: LinhaElenco) => (
                <button
                  key={j.memberId}
                  type="button"
                  onClick={() => reforcar(folha.lado, j.memberId)}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm font-semibold"
                >
                  {j.nome}
                  {j.time !== null && (
                    <span className="block text-[10px] font-medium text-muted-foreground">
                      {nomeTime(j.time)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </Folha>
      )}
    </div>
  );
}

/** Ignora o segundo toque de um toque duplo (dedo nervoso = gol duplicado). */
function useRefDeToque() {
  const ultimo = useRef(0);
  return () => {
    const agora = Date.now();
    if (agora - ultimo.current < 500) return false;
    ultimo.current = agora;
    return true;
  };
}

function Folha({
  titulo,
  onFechar,
  children,
}: {
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-label={titulo}
        className="max-h-[85dvh] w-full max-w-[480px] space-y-3 overflow-auto rounded-t-3xl bg-card p-4 pb-6"
      >
        <h2 className="text-lg font-extrabold text-foreground">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}
