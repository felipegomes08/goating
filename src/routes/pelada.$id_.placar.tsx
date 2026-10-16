import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowLeftRight,
  Flag,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useSession } from "@/hooks/use-session";
import { useVoltar } from "@/hooks/use-voltar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  liberarAudio,
  manterTelaLigada,
  soltarTela,
  pararAlarme,
  tocarAlarme,
  vibrar,
} from "@/lib/placar/alarme";
import { TabelaTimes } from "@/components/goating/tabela-times";
import { EntradaDeJogador } from "@/components/goating/entrada-de-jogador";
import { carregarElenco, podeGerirPelada, type LinhaElenco } from "@/lib/placar/dados";
import {
  NOME_DO_LANCE,
  TIPOS_DE_LANCE,
  ajustarVencedor,
  colocarNoLado,
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
  placarDosPenaltis,
  saldoDosJogadores,
  sugerirProximo,
  tabelaDosTimes,
  tirarDoJogo,
  type Contagem,
  type EstadoPlacar,
  type Jogo,
  type Lado,
  type TipoDeLance,
} from "@/lib/placar/estado";

/** Cor de cada lance nas marcas e na lista (classes completas pro Tailwind enxergar). */
const COR_DO_LANCE: Record<TipoDeLance, string> = {
  assistencia: "bg-emerald-500",
  defesa: "bg-sky-500",
  amarelo: "bg-yellow-400",
  azul: "bg-blue-600",
  vermelho: "bg-red-600",
};

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
  const voltar = useVoltar(
    () => void navigate({ to: "/pelada/$id", params: { id }, replace: true }),
  );

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
    | { tipo: "lance"; lado: Lado; memberId: string; trocando?: boolean }
    | { tipo: "fim-dos-penaltis" }
    | { tipo: "editar-jogo"; jogoId: string }
    | null
  >(null);
  // quem entrou no elenco com o jogo rolando (a consulta do elenco é carregada uma vez só)
  const [elencoLocal, setElencoLocal] = useState<LinhaElenco[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  // gol que acabou de sair: a faixa pergunta de quem foi a assistência
  const [golRecente, setGolRecente] = useState<{ golId: string; lado: Lado } | null>(null);
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
      soltarTela();
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

  // a pergunta da assistência some sozinha: ninguém é obrigado a responder
  useEffect(() => {
    if (!golRecente) return;
    const espera = setTimeout(() => setGolRecente(null), 20_000);
    return () => clearTimeout(espera);
  }, [golRecente]);

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

  const { pelada } = dados;
  const elenco = elencoLocal ?? dados.elenco;
  const numTimes = pelada.num_times;
  const jaComecou = new Date(`${pelada.data}T${pelada.horario}`).getTime() <= Date.now();
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
    // gol contra / sem autor não tem assistência
    setGolRecente(memberId ? { golId, lado } : null);
    if (pelada.gols_limite && novoPlacar[lado] >= pelada.gols_limite)
      setFolha({ tipo: "encerrar" });
  }

  function apagarGol(golId: string) {
    // a assistência daquele gol vai embora junto
    mudarAtual((j) => ({
      ...j,
      gols: j.gols.filter((g) => g.id !== golId),
      lances: (j.lances ?? []).filter((l) => l.golId !== golId),
    }));
    setGolRecente((g) => (g?.golId === golId ? null : g));
  }

  /** Assistência, defesa épica ou cartão. `golId` liga a assistência ao gol que ela serviu. */
  function marcarLance(tipo: TipoDeLance, lado: Lado, memberId: string, golId?: string) {
    if (!atual) return;
    const lanceId = crypto.randomUUID();
    mudarAtual((j) => ({
      ...j,
      lances: [
        ...(j.lances ?? []),
        {
          id: lanceId,
          tipo,
          lado,
          memberId,
          tempo: j.tempo,
          minuto: Math.floor(decorridoMs(j) / 60_000) + 1,
          ...(golId ? { golId } : {}),
        },
      ],
    }));
    setFolha(null);
    setGolRecente(null);
    toast(`${NOME_DO_LANCE[tipo]}: ${nomeJogador(memberId)}`, {
      duration: 6000,
      action: { label: "Desfazer", onClick: () => apagarLance(lanceId) },
    });
  }

  function apagarLance(lanceId: string) {
    mudarAtual((j) => ({ ...j, lances: (j.lances ?? []).filter((l) => l.id !== lanceId) }));
  }

  // ───────────── Disputa de pênaltis ─────────────
  function irProsPenaltis() {
    silenciar();
    setGolRecente(null);
    // o relógio para: o tempo normal acabou
    mudarAtual((j) => ({
      ...j,
      duracaoMs: j.duracaoMs + decorridoMs(j),
      acumuladoMs: 0,
      iniciadoEm: null,
      penaltis: { gols: [], contaNaArtilharia: true },
    }));
    setFolha(null);
    window.scrollTo({ top: 0 });
  }

  function marcarPenalti(lado: Lado, memberId: string | null) {
    if (!atual?.penaltis || !ultimoToque()) return;
    const penaltiId = crypto.randomUUID();
    const [a, b] = placarDosPenaltis(atual) ?? [0, 0];
    const novo: [number, number] = lado === 0 ? [a + 1, b] : [a, b + 1];
    mudarAtual((j) =>
      j.penaltis
        ? {
            ...j,
            penaltis: {
              ...j.penaltis,
              gols: [...j.penaltis.gols, { id: penaltiId, lado, memberId }],
            },
          }
        : j,
    );
    vibrar(80);
    toast(`Pênalti de ${nomeJogador(memberId)}`, {
      description: `${nomeTime(atual.times[0])} ${novo[0]} × ${novo[1]} ${nomeTime(atual.times[1])}`,
      duration: 6000,
      action: { label: "Desfazer", onClick: () => apagarPenalti(penaltiId) },
    });
  }

  function apagarPenalti(penaltiId: string) {
    mudarAtual((j) =>
      j.penaltis
        ? {
            ...j,
            penaltis: { ...j.penaltis, gols: j.penaltis.gols.filter((g) => g.id !== penaltiId) },
          }
        : j,
    );
  }

  function contarPenaltisNaArtilharia(conta: boolean) {
    mudarAtual((j) =>
      j.penaltis ? { ...j, penaltis: { ...j.penaltis, contaNaArtilharia: conta } } : j,
    );
  }

  /** Desiste da disputa e volta pro jogo, como se não tivesse ido pros pênaltis. */
  function cancelarPenaltis() {
    mudarAtual((j) => ({ ...j, penaltis: null }));
    setFolha(null);
  }

  function trocarAutor(golId: string, lado: Lado, memberId: string | null) {
    mudarAtual((j) => ({
      ...j,
      gols: j.gols.map((g) => (g.id === golId ? { ...g, lado, memberId } : g)),
    }));
    setFolha(null);
  }

  function reforcar(lado: Lado, memberId: string) {
    mudarAtual((j) => colocarNoLado(j, memberId, lado));
    setFolha(null);
  }

  /** Quem entrou e não estava no elenco do dia passa a estar (a tela de times já gravou). */
  function incluirNoElenco(linha: LinhaElenco) {
    setElencoLocal((atualizado) => {
      const lista = atualizado ?? elenco;
      return lista.some((j) => j.memberId === linha.memberId) ? lista : [...lista, linha];
    });
  }

  /**
   * Passa o jogador pro outro lado do jogo que está rolando. "Daqui pra frente" muda também o
   * time dele no elenco do dia, e os próximos jogos já começam com ele no time novo.
   */
  async function passarProOutroLado(memberId: string, lado: Lado, daquiPraFrente: boolean) {
    if (!atual) return;
    const outro: Lado = lado === 0 ? 1 : 0;
    const timeNovo = atual.times[outro];
    reforcar(outro, memberId);
    toast(`${nomeJogador(memberId)} foi pro ${nomeTime(timeNovo)}`, {
      description: daquiPraFrente ? "Daqui pra frente." : "Só neste jogo.",
    });
    if (!daquiPraFrente) return;
    setElencoLocal((atualizado) =>
      (atualizado ?? elenco).map((j) => (j.memberId === memberId ? { ...j, time: timeNovo } : j)),
    );
    const { error } = await supabase
      .from("match_players")
      .update({ time: timeNovo })
      .eq("match_id", id)
      .eq("member_id", memberId);
    if (error)
      toast.error("Mudou neste jogo, mas não deu pra salvar o time novo. Confere a internet.");
  }

  /** Mexe num jogo já encerrado (lista "Jogos de hoje" ou "Corrigir placar"). */
  function mudarJogo(jogoId: string, fn: (jogo: Jogo) => Jogo) {
    setEstado((e) =>
      e ? { ...e, jogos: e.jogos.map((j) => (j.id === jogoId ? ajustarVencedor(fn(j)) : j)) } : e,
    );
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
        replace
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
      <div className="app-shell flex min-h-dvh flex-col">
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
                  const penaltis = placarDosPenaltis(j);
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
                      <span className="w-16 truncate text-right text-[10px] font-bold text-muted-foreground">
                        {penaltis
                          ? `${penaltis[0]} × ${penaltis[1]} pên.`
                          : j.vencedor === null
                            ? "empate"
                            : a === b
                              ? "desempate"
                              : ""}
                      </span>
                      <button
                        type="button"
                        aria-label={`Editar o jogo ${i + 1}`}
                        onClick={() => setFolha({ tipo: "editar-jogo", jogoId: j.id })}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
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
            {!jaComecou && (
              <p className="mb-2 text-center text-xs text-muted-foreground">
                Dá pra finalizar a partir do horário da pelada ({pelada.horario.slice(0, 5)}).
              </p>
            )}
            <Button
              variant="outline"
              className="w-full"
              disabled={!jaComecou}
              onClick={() => setFolha({ tipo: "finalizar" })}
            >
              <Flag className="mr-2 size-4" /> Finalizar pelada
            </Button>
          </div>
        )}

        {folha?.tipo === "editar-jogo" &&
          (() => {
            const jogo = estado.jogos.find((j) => j.id === folha.jogoId);
            if (!jogo) return null;
            return (
              <Folha
                titulo={`Jogo ${estado.jogos.indexOf(jogo) + 1}: ${nomeTime(jogo.times[0])} ${placarDoJogo(jogo)[0]} × ${placarDoJogo(jogo)[1]} ${nomeTime(jogo.times[1])}`}
                onFechar={() => setFolha(null)}
              >
                <EditorDeJogo
                  jogo={jogo}
                  matchId={id}
                  crewId={pelada.crew_id}
                  elenco={elenco}
                  nomeTime={nomeTime}
                  nomeJogador={nomeJogador}
                  onMudar={(fn) => mudarJogo(jogo.id, fn)}
                  onIncluirNoElenco={incluirNoElenco}
                  onPronto={() => setFolha(null)}
                />
              </Folha>
            );
          })()}

        {folha?.tipo === "finalizar" && (
          <Folha titulo="Finalizar a pelada?" onFechar={() => setFolha(null)}>
            <p className="text-sm text-muted-foreground">
              Salva {encerrados.length} {encerrados.length === 1 ? "jogo" : "jogos"} nas
              estatísticas da turma e abre as avaliações por 2h.
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

  const folhaReforco = folha?.tipo === "reforco" && (
    <Folha
      titulo={`Quem entrou no ${nomeTime(atual.times[folha.lado])}?`}
      onFechar={() => setFolha(null)}
    >
      <EntradaDeJogador
        matchId={id}
        crewId={pelada.crew_id}
        time={atual.times[folha.lado]}
        elenco={elenco}
        ocupados={[...atual.lados[0], ...atual.lados[1]]}
        nomeTime={nomeTime}
        onEntrou={(linha) => {
          incluirNoElenco(linha);
          reforcar(folha.lado, linha.memberId);
        }}
      />
    </Folha>
  );

  // ───────────── Disputa de pênaltis ─────────────
  if (atual.penaltis) {
    const [jogoA, jogoB] = placarDoJogo(atual);
    const [penA, penB] = placarDosPenaltis(atual) ?? [0, 0];
    const disputa = atual.penaltis;
    return (
      <div className="app-shell flex min-h-dvh flex-col">
        {cabecalho}
        <div className="space-y-4 p-4">
          <section className="space-y-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground uppercase">
                Jogo {estado.jogos.length} · Pênaltis
              </span>
              {/* o placar do jogo fica pequeno, só de referência */}
              <span className="truncate text-[11px] font-semibold text-muted-foreground">
                Tempo normal: {nomeTime(atual.times[0])} {jogoA} × {jogoB}{" "}
                {nomeTime(atual.times[1])}
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
                    {lado === 0 ? penA : penB}
                  </p>
                </div>
              ))}
              <span className="order-2 text-3xl font-bold text-muted-foreground">×</span>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 px-3 py-2.5">
              <span className="text-sm font-semibold text-foreground">
                Contar esses gols na artilharia
              </span>
              <Switch
                checked={disputa.contaNaArtilharia}
                onCheckedChange={contarPenaltisNaArtilharia}
              />
            </label>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={cancelarPenaltis}>
                Voltar pro jogo
              </Button>
              <Button className="flex-[2]" onClick={() => setFolha({ tipo: "fim-dos-penaltis" })}>
                Encerrar pênaltis
              </Button>
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs text-muted-foreground">
              Toque em quem bateu e fez. Não tem número certo de cobranças: encerra quando quiser.
            </p>
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
                      const feitos = disputa.gols.filter(
                        (g) => g.lado === lado && g.memberId === memberId,
                      ).length;
                      return (
                        <button
                          key={memberId}
                          type="button"
                          onClick={() => marcarPenalti(lado, memberId)}
                          className={cn(
                            "flex min-h-14 w-full items-center justify-between gap-1 rounded-xl border-2 px-3 py-3 text-left font-semibold text-foreground active:scale-[0.97]",
                            cor.fundo,
                            cor.borda,
                          )}
                        >
                          <span className="min-w-0 break-words">{nomeJogador(memberId)}</span>
                          {feitos > 0 && (
                            <span
                              className={cn(
                                "min-w-7 shrink-0 rounded-full px-1.5 text-center text-lg font-black text-white tabular-nums",
                                cor.solido,
                              )}
                            >
                              {feitos}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => marcarPenalti(lado, null)}
                      className={cn(
                        "w-full rounded-xl border border-dashed py-2.5 text-xs font-bold",
                        cor.borda,
                        cor.texto,
                      )}
                    >
                      + Pênalti sem autor
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

          {disputa.gols.length > 0 && (
            <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
              <h2 className="mb-1 text-sm font-bold text-foreground">Pênaltis convertidos</h2>
              <ul className="divide-y divide-border">
                {[...disputa.gols].reverse().map((g, i) => (
                  <li key={g.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="w-6 text-xs font-bold text-muted-foreground tabular-nums">
                      {disputa.gols.length - i}
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
                      onClick={() => apagarPenalti(g.id)}
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

        {folha?.tipo === "fim-dos-penaltis" && (
          <Folha
            titulo={`Pênaltis: ${nomeTime(atual.times[0])} ${penA} × ${penB} ${nomeTime(atual.times[1])}`}
            onFechar={() => setFolha(null)}
          >
            {penA === penB ? (
              <>
                <p className="text-sm text-muted-foreground">
                  A disputa está empatada. Dá pra continuar batendo, ou decidir aqui quem levou.
                </p>
                <Button className="w-full" onClick={() => setFolha(null)}>
                  Continuar batendo
                </Button>
                {([0, 1] as const).map((lado) => (
                  <Button
                    key={lado}
                    variant="outline"
                    className="w-full"
                    onClick={() => encerrarJogo(lado)}
                  >
                    {nomeTime(atual.times[lado])} venceu
                  </Button>
                ))}
                <Button variant="outline" className="w-full" onClick={() => encerrarJogo(null)}>
                  Ficou no empate
                </Button>
              </>
            ) : (
              <>
                <Button className="w-full" onClick={() => encerrarJogo(penA > penB ? 0 : 1)}>
                  Encerrar · {nomeTime(atual.times[penA > penB ? 0 : 1])} venceu nos pênaltis
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setFolha(null)}>
                  Ainda tem cobrança
                </Button>
              </>
            )}
          </Folha>
        )}

        {folhaReforco}
      </div>
    );
  }

  // ───────────── Bola rolando ─────────────
  const ms = decorridoMs(atual, agora);
  const estourou = ms >= limiteMs;
  const [golsA, golsB] = placarDoJogo(atual);
  const ultimoTempo = atual.tempo >= pelada.tempos;
  const lances = atual.lances ?? [];
  // o gol que acabou de sair, se ainda existe e ninguém marcou a assistência dele
  const golDaFaixa =
    golRecente && !lances.some((l) => l.golId === golRecente.golId)
      ? atual.gols.find((g) => g.id === golRecente.golId && g.memberId)
      : undefined;
  // gols e lances numa lista só, do mais novo pro mais antigo
  const historico = [...atual.gols.map((g) => ({ ...g, tipo: "gol" as const })), ...lances].sort(
    (a, b) => b.tempo - a.tempo || b.minuto - a.minuto,
  );
  const golEmEdicao =
    folha?.tipo === "autor" ? atual.gols.find((g) => g.id === folha.golId) : undefined;

  return (
    <div
      className={cn("app-shell flex min-h-dvh flex-col", alarme ? "pb-28" : golDaFaixa && "pb-44")}
    >
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
          <p className="mb-2 text-xs text-muted-foreground">
            Toque no nome de quem fez o gol. O + marca assistência, defesa épica e cartão.
          </p>
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
                    const dele = lances.filter((l) => l.memberId === memberId);
                    return (
                      <div
                        key={memberId}
                        className={cn(
                          "flex min-h-14 w-full items-stretch rounded-xl border-2 font-semibold text-foreground",
                          cor.fundo,
                          cor.borda,
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => marcarGol(lado, memberId)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-1 py-2.5 pr-1 pl-3 text-left active:scale-[0.97]"
                        >
                          <span className="min-w-0">
                            <span className="block break-words">{nomeJogador(memberId)}</span>
                            {dele.length > 0 && (
                              <span className="mt-1 flex flex-wrap items-center gap-1">
                                {TIPOS_DE_LANCE.map((tipo) => {
                                  const vezes = dele.filter((l) => l.tipo === tipo).length;
                                  return vezes > 0 ? (
                                    <span
                                      key={tipo}
                                      title={NOME_DO_LANCE[tipo]}
                                      className={cn(
                                        "rounded px-1 text-[10px] leading-4 font-black text-white",
                                        COR_DO_LANCE[tipo],
                                        tipo === "amarelo" && "text-black",
                                      )}
                                    >
                                      {tipo === "assistencia" ? "A" : tipo === "defesa" ? "D" : ""}
                                      {vezes > 1 || tipo === "assistencia" || tipo === "defesa"
                                        ? vezes
                                        : "\u00a0"}
                                    </span>
                                  ) : null;
                                })}
                              </span>
                            )}
                          </span>
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
                        <button
                          type="button"
                          aria-label={`Outro lance de ${nomeJogador(memberId)}`}
                          onClick={() => setFolha({ tipo: "lance", lado, memberId })}
                          className={cn(
                            "flex w-10 shrink-0 items-center justify-center rounded-r-[10px] border-l-2 active:opacity-60",
                            cor.borda,
                            cor.texto,
                          )}
                        >
                          <Plus className="size-5" />
                        </button>
                      </div>
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

        {historico.length > 0 && (
          <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
            <h2 className="mb-1 text-sm font-bold text-foreground">Lances</h2>
            <ul className="divide-y divide-border">
              {historico.map((g) => (
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
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{nomeJogador(g.memberId)}</span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      {g.tipo !== "gol" && (
                        <span className={cn("size-2 rounded-sm", COR_DO_LANCE[g.tipo])} />
                      )}
                      {g.tipo === "gol" ? "Gol" : NOME_DO_LANCE[g.tipo]}
                    </span>
                  </span>
                  {g.tipo === "gol" && (
                    <button
                      type="button"
                      onClick={() => setFolha({ tipo: "autor", golId: g.id })}
                      className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                    >
                      Trocar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => (g.tipo === "gol" ? apagarGol(g.id) : apagarLance(g.id))}
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

      {/* de quem foi a assistência do gol que acabou de sair; dá pra ignorar */}
      {golDaFaixa && !alarme && !folha && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center p-3">
          <div className="w-full max-w-[456px] space-y-2 rounded-2xl bg-primary p-3 shadow-[var(--shadow-float)]">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-bold text-primary-foreground">
                Assistência no gol de {nomeJogador(golDaFaixa.memberId)}?
              </p>
              <button
                type="button"
                aria-label="Sem assistência"
                onClick={() => setGolRecente(null)}
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-primary-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-auto">
              {atual.lados[golDaFaixa.lado]
                .filter((m) => m !== golDaFaixa.memberId)
                .map((memberId) => (
                  <button
                    key={memberId}
                    type="button"
                    onClick={() =>
                      marcarLance("assistencia", golDaFaixa.lado, memberId, golDaFaixa.id)
                    }
                    className="rounded-full bg-primary-foreground px-3 py-1.5 text-xs font-bold text-primary active:opacity-70"
                  >
                    {nomeJogador(memberId)}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

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
              <Button variant="secondary" className="w-full" onClick={irProsPenaltis}>
                Ir pros pênaltis
              </Button>
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

      {folha?.tipo === "lance" && folha.trocando && (
        <Folha
          titulo={`${nomeJogador(folha.memberId)} pro ${nomeTime(atual.times[folha.lado === 0 ? 1 : 0])}`}
          onFechar={() => setFolha(null)}
        >
          <p className="text-sm text-muted-foreground">
            Os gols que ele já fez continuam valendo pro time em que saíram: o placar não muda.
          </p>
          <Button
            className="w-full"
            onClick={() => void passarProOutroLado(folha.memberId, folha.lado, false)}
          >
            Só neste jogo
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void passarProOutroLado(folha.memberId, folha.lado, true)}
          >
            Daqui pra frente
          </Button>
          <p className="text-xs text-muted-foreground">
            “Daqui pra frente” também muda o time dele nos próximos jogos de hoje.
          </p>
        </Folha>
      )}

      {folha?.tipo === "lance" && !folha.trocando && (
        <Folha titulo={nomeJogador(folha.memberId)} onFechar={() => setFolha(null)}>
          <button
            type="button"
            onClick={() => setFolha({ ...folha, trocando: true })}
            className="flex min-h-12 w-full items-center gap-2.5 rounded-xl border-2 border-border bg-background px-3 text-left text-sm font-bold text-foreground active:scale-[0.97]"
          >
            <ArrowLeftRight className="size-5 shrink-0 text-muted-foreground" />
            Passar pro {nomeTime(atual.times[folha.lado === 0 ? 1 : 0])}
          </button>
          <p className="text-sm text-muted-foreground">
            Ou marque um lance. Gol é só tocar no nome dele, direto na lista.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TIPOS_DE_LANCE.map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => marcarLance(tipo, folha.lado, folha.memberId)}
                className={cn(
                  "flex min-h-14 items-center gap-2.5 rounded-xl border-2 border-border bg-background px-3 text-left text-sm font-bold text-foreground active:scale-[0.97]",
                  // as duas jogadas em cima, os três cartões embaixo
                  tipo === "vermelho" && "col-span-2",
                )}
              >
                <span className={cn("size-5 shrink-0 rounded", COR_DO_LANCE[tipo])} />
                {NOME_DO_LANCE[tipo]}
              </button>
            ))}
          </div>
        </Folha>
      )}

      {folhaReforco}
    </div>
  );
}

/**
 * Mexe num jogo que já acabou: passar alguém pro outro lado, tirar do jogo, colocar quem
 * faltou (o goleiro que esqueceram de cadastrar), trocar o autor de um gol ou apagar um lance.
 */
function EditorDeJogo({
  jogo,
  matchId,
  crewId,
  elenco,
  nomeTime,
  nomeJogador,
  onMudar,
  onIncluirNoElenco,
  onPronto,
}: {
  jogo: Jogo;
  matchId: string;
  crewId: string | null;
  elenco: LinhaElenco[];
  nomeTime: (time: number) => string;
  nomeJogador: (memberId: string | null) => string;
  onMudar: (fn: (jogo: Jogo) => Jogo) => void;
  onIncluirNoElenco: (linha: LinhaElenco) => void;
  onPronto: () => void;
}) {
  const [modo, setModo] = useState<
    { tipo: "adicionar"; lado: Lado } | { tipo: "autor"; golId: string } | null
  >(null);
  const lances = jogo.lances ?? [];
  const historico = [...jogo.gols.map((g) => ({ ...g, tipo: "gol" as const })), ...lances].sort(
    (a, b) => a.tempo - b.tempo || a.minuto - b.minuto,
  );

  if (modo?.tipo === "adicionar") {
    return (
      <>
        <p className="text-sm text-muted-foreground">
          Quem jogou no {nomeTime(jogo.times[modo.lado])} e não foi marcado?
        </p>
        <EntradaDeJogador
          matchId={matchId}
          crewId={crewId}
          time={jogo.times[modo.lado]}
          elenco={elenco}
          ocupados={[...jogo.lados[0], ...jogo.lados[1]]}
          nomeTime={nomeTime}
          onEntrou={(linha) => {
            onIncluirNoElenco(linha);
            onMudar((j) => colocarNoLado(j, linha.memberId, modo.lado));
            setModo(null);
          }}
        />
        <Button variant="outline" className="w-full" onClick={() => setModo(null)}>
          Voltar
        </Button>
      </>
    );
  }

  const golEmEdicao =
    modo?.tipo === "autor" ? jogo.gols.find((g) => g.id === modo.golId) : undefined;
  if (golEmEdicao) {
    return (
      <>
        <p className="text-sm text-muted-foreground">Quem fez o gol dos {golEmEdicao.minuto}'?</p>
        <div className="grid grid-cols-2 gap-3">
          {([0, 1] as const).map((lado) => {
            const cor = corDoTime(jogo.times[lado]);
            return (
              <div key={lado} className="min-w-0 space-y-1.5">
                <p className={cn("truncate text-xs font-extrabold uppercase", cor.texto)}>
                  {nomeTime(jogo.times[lado])}
                </p>
                {[...jogo.lados[lado], null].map((memberId) => (
                  <button
                    key={memberId ?? "sem"}
                    type="button"
                    onClick={() => {
                      onMudar((j) => ({
                        ...j,
                        gols: j.gols.map((g) =>
                          g.id === golEmEdicao.id ? { ...g, lado, memberId } : g,
                        ),
                      }));
                      setModo(null);
                    }}
                    className={cn(
                      "w-full rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold",
                      cor.borda,
                      golEmEdicao.lado === lado && golEmEdicao.memberId === memberId
                        ? cn(cor.solido, "text-white")
                        : cn(cor.fundo, "text-foreground"),
                    )}
                  >
                    {memberId ? nomeJogador(memberId) : "Sem autor / contra"}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <Button variant="outline" className="w-full" onClick={() => setModo(null)}>
          Voltar
        </Button>
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {([0, 1] as const).map((lado) => {
          const cor = corDoTime(jogo.times[lado]);
          return (
            <div key={lado} className="min-w-0 space-y-1.5">
              <p
                className={cn(
                  "truncate border-b-4 pb-1 text-xs font-extrabold uppercase",
                  cor.texto,
                  cor.borda,
                )}
              >
                {nomeTime(jogo.times[lado])}
              </p>
              {jogo.lados[lado].map((memberId) => (
                <div
                  key={memberId}
                  className={cn(
                    "flex items-center gap-1 rounded-xl border-2 pl-2.5",
                    cor.fundo,
                    cor.borda,
                  )}
                >
                  <span className="min-w-0 flex-1 truncate py-2 text-sm font-semibold text-foreground">
                    {nomeJogador(memberId)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Passar ${nomeJogador(memberId)} pro outro time`}
                    onClick={() => onMudar((j) => colocarNoLado(j, memberId, lado === 0 ? 1 : 0))}
                    className="flex size-8 shrink-0 items-center justify-center text-muted-foreground"
                  >
                    <ArrowLeftRight className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Tirar ${nomeJogador(memberId)} deste jogo`}
                    onClick={() => onMudar((j) => tirarDoJogo(j, memberId))}
                    className="flex size-8 shrink-0 items-center justify-center text-muted-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setModo({ tipo: "adicionar", lado })}
                className={cn(
                  "w-full rounded-xl border border-dashed py-2 text-xs font-bold",
                  cor.borda,
                  cor.texto,
                )}
              >
                + Adicionar jogador
              </button>
            </div>
          );
        })}
      </div>

      {historico.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold text-muted-foreground uppercase">Lances</p>
          <ul className="divide-y divide-border">
            {historico.map((g) => (
              <li key={g.id} className="flex items-center gap-2 py-2 text-sm">
                <span className="w-9 text-xs font-extrabold tabular-nums">{g.minuto}'</span>
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    corDoTime(jogo.times[g.lado]).solido,
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{nomeJogador(g.memberId)}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {g.tipo === "gol" ? "Gol" : NOME_DO_LANCE[g.tipo]}
                  </span>
                </span>
                {g.tipo === "gol" && (
                  <button
                    type="button"
                    onClick={() => setModo({ tipo: "autor", golId: g.id })}
                    className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                  >
                    Trocar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    onMudar((j) =>
                      g.tipo === "gol"
                        ? {
                            ...j,
                            gols: j.gols.filter((x) => x.id !== g.id),
                            lances: (j.lances ?? []).filter((l) => l.golId !== g.id),
                          }
                        : { ...j, lances: (j.lances ?? []).filter((l) => l.id !== g.id) },
                    )
                  }
                  className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                >
                  Apagar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button className="w-full" onClick={onPronto}>
        Pronto
      </Button>
    </>
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
