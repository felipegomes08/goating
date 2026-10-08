import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ClipboardPaste,
  Minus,
  Play,
  Plus,
  Share2,
  Shuffle,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useVoltar } from "@/hooks/use-voltar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { BuscaJogador, type PerfilAchado } from "@/components/goating/busca-jogador";
import { QuadroTimes } from "@/components/goating/quadro-times";
import { cn } from "@/lib/utils";
import {
  compartilhar,
  overallDoPerfil,
  prepararTimes,
  textoDosTimes,
  type JogadorDoDia,
  type Membro,
} from "@/lib/placar/dados";
import { NOMES_PADRAO, nomeDoTime } from "@/lib/placar/estado";
import { acharMembro, lerLista } from "@/lib/placar/lista";
import {
  ESTRELAS_PADRAO,
  POSICOES,
  estrelasDoOverall,
  forcaDoJogador,
  sortearTimes,
  type BaseDoSorteio,
} from "@/lib/placar/sorteio";

const CHAVE_BASE = "goating-sorteio-base";

export const Route = createFileRoute("/pelada/$id_/times")({
  ssr: false,
  head: () => ({ meta: [{ title: "Times · Goating" }] }),
  component: TimesDaPelada,
});

function TimesDaPelada() {
  const { id } = useParams({ from: "/pelada/$id_/times" });
  const { userId, carregando } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const voltar = useVoltar(() => void navigate({ to: "/pelada/$id", params: { id } }));

  const consulta = useQuery({
    queryKey: ["pelada-times", id, userId],
    enabled: !!userId,
    // a tela guarda o elenco em estado local; recarregar por trás apagaria o que está sendo editado
    staleTime: Infinity,
    gcTime: 0,
    queryFn: () => prepararTimes(id, userId!),
  });

  const [jogadores, setJogadores] = useState<JogadorDoDia[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [confirmadosFora, setConfirmadosFora] = useState<JogadorDoDia[]>([]);
  const [numTimes, setNumTimes] = useState(2);
  const [nomes, setNomes] = useState<string[]>(NOMES_PADRAO(2));
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [base, setBase] = useState<BaseDoSorteio>(() => {
    try {
      return localStorage.getItem(CHAVE_BASE) === "overall" ? "overall" : "estrelas";
    } catch {
      return "estrelas";
    }
  });
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const dados = consulta.data;
  useEffect(() => {
    if (!dados?.souOrganizador) return;
    setJogadores(dados.jogadores);
    setMembros(dados.membros);
    setConfirmadosFora(dados.confirmadosFora);
    setNumTimes(dados.pelada.num_times);
    setNomes(dados.pelada.nomes_times ?? NOMES_PADRAO(dados.pelada.num_times));
  }, [dados]);

  if (carregando || consulta.isLoading) {
    return (
      <div className="app-shell space-y-3 p-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }
  if (!dados?.souOrganizador) {
    return (
      <div className="app-shell flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {consulta.isError
            ? "Não conseguimos carregar os times."
            : "Só o organizador ou um administrador da turma monta os times."}
        </p>
        <Button asChild>
          <Link to="/pelada/$id" params={{ id }}>
            Voltar pra pelada
          </Link>
        </Button>
      </div>
    );
  }

  const pelada = dados.pelada;
  const crewId = pelada.crew_id;
  const times = Array.from({ length: numTimes }, (_, i) => jogadores.filter((j) => j.time === i));
  const semTime = jogadores.filter((j) => j.time === null || j.time >= numTimes);
  const temTimes = times.some((t) => t.length > 0);
  const prontoPraJogar = times.filter((t) => t.length > 0).length >= 2;
  const comOverall = jogadores.filter((j) => j.overall !== null).length;

  async function gravarTimes(lista: JogadorDoDia[]) {
    setJogadores(lista);
    const { error } = await supabase.from("match_players").upsert(
      lista.map((j) => ({ match_id: id, member_id: j.memberId, time: j.time })),
      { onConflict: "match_id,member_id" },
    );
    if (error) toast.error("Não deu pra salvar os times. Confere a internet.");
  }

  async function gravarConfig(n: number, nomesTimes: string[]) {
    setNumTimes(n);
    setNomes(nomesTimes);
    const { error } = await supabase
      .from("matches")
      .update({ num_times: n, nomes_times: nomesTimes })
      .eq("id", id);
    if (error) toast.error("Não deu pra salvar a quantidade de times.");
  }

  async function mudarNumTimes(n: number) {
    const nomesTimes = Array.from({ length: n }, (_, i) => nomeDoTime(nomes, i));
    await gravarConfig(n, nomesTimes);
    if (jogadores.some((j) => j.time !== null && j.time >= n)) {
      await gravarTimes(
        jogadores.map((j) => (j.time !== null && j.time >= n ? { ...j, time: null } : j)),
      );
    }
  }

  async function sortear() {
    const anterior = temTimes ? times.map((t) => t.map((j) => j.memberId)) : undefined;
    const sorteio = sortearTimes(
      jogadores.map((j) => ({
        id: j.memberId,
        estrelas: forcaDoJogador(j, base),
        posicao: j.posicao,
      })),
      numTimes,
      anterior,
    );
    setSelecionado(null);
    await gravarTimes(
      jogadores.map((j) => ({ ...j, time: sorteio.findIndex((t) => t.includes(j.memberId)) })),
    );
  }

  /** Toque num jogador seleciona; toque em outro troca os dois de lugar. */
  async function tocarJogador(memberId: string) {
    if (!selecionado) return setSelecionado(memberId);
    if (selecionado === memberId) return setSelecionado(null);
    const a = jogadores.find((j) => j.memberId === selecionado);
    const b = jogadores.find((j) => j.memberId === memberId);
    setSelecionado(null);
    if (!a || !b || a.time === b.time) return;
    await gravarTimes(
      jogadores.map((j) =>
        j.memberId === a.memberId
          ? { ...j, time: b.time }
          : j.memberId === b.memberId
            ? { ...j, time: a.time }
            : j,
      ),
    );
  }

  async function moverJogador(memberId: string, time: number | null) {
    setSelecionado(null);
    await gravarTimes(jogadores.map((j) => (j.memberId === memberId ? { ...j, time } : j)));
  }

  function mudarBase(nova: BaseDoSorteio) {
    setBase(nova);
    try {
      localStorage.setItem(CHAVE_BASE, nova);
    } catch {
      // sem armazenamento: a escolha vale só nessa visita
    }
  }

  async function atualizarMembro(
    memberId: string,
    mudanca: { posicao?: string | null; estrelas?: number },
  ) {
    setJogadores((lista) => lista.map((j) => (j.memberId === memberId ? { ...j, ...mudanca } : j)));
    const { error } = await supabase.from("crew_members").update(mudanca).eq("id", memberId);
    if (error) toast.error("Não deu pra salvar esse jogador.");
  }

  async function remover(memberId: string) {
    const removido = jogadores.find((j) => j.memberId === memberId);
    setJogadores((lista) => lista.filter((j) => j.memberId !== memberId));
    if (selecionado === memberId) setSelecionado(null);
    const { error } = await supabase
      .from("match_players")
      .delete()
      .eq("match_id", id)
      .eq("member_id", memberId);
    if (error) {
      toast.error("Não deu pra tirar esse jogador.");
      if (removido) setJogadores((lista) => [...lista, removido]);
    }
  }

  /** Coloca no elenco do dia quem já é da turma (pelo nome) e cria quem ainda não é. */
  async function adicionarNomes(lista: { nome: string; time: number | null }[]) {
    const conhecidos = [...membros];
    const paraCriar: { nome: string; time: number | null }[] = [];
    const entradas: { membro: Membro; time: number | null }[] = [];
    for (const item of lista) {
      const membro = acharMembro(conhecidos, item.nome);
      if (membro) entradas.push({ membro, time: item.time });
      else paraCriar.push(item);
    }
    if (paraCriar.length > 0) {
      const { data: criados, error } = await supabase
        .from("crew_members")
        .insert(paraCriar.map((p) => ({ crew_id: crewId, nome: p.nome })))
        .select("*");
      if (error) throw error;
      criados.forEach((membro, i) => entradas.push({ membro, time: paraCriar[i]?.time ?? null }));
      setMembros((atuais) => [...atuais, ...criados]);
    }

    const novos: JogadorDoDia[] = [];
    let atualizados = jogadores;
    for (const { membro, time } of entradas) {
      const jaNoElenco = atualizados.some((j) => j.memberId === membro.id);
      if (jaNoElenco) {
        if (time !== null)
          atualizados = atualizados.map((j) => (j.memberId === membro.id ? { ...j, time } : j));
        continue;
      }
      if (novos.some((j) => j.memberId === membro.id)) continue;
      const conhecido = confirmadosFora.find((j) => j.memberId === membro.id);
      novos.push({
        memberId: membro.id,
        userId: membro.user_id,
        nome: membro.nome,
        posicao: conhecido?.posicao ?? membro.posicao,
        estrelas: conhecido?.estrelas ?? membro.estrelas ?? ESTRELAS_PADRAO,
        overall: conhecido?.overall ?? null,
        time,
      });
    }
    setConfirmadosFora((fora) => fora.filter((f) => !novos.some((n) => n.memberId === f.memberId)));
    await gravarTimes([...atualizados, ...novos]);
    return novos.length;
  }

  async function adicionarDaLista() {
    const lida = lerLista(texto);
    if (lida.nomes.length === 0) {
      toast.error("Não achei nenhum nome nessa lista.");
      return;
    }
    setOcupado(true);
    try {
      if (lida.times) {
        const n = Math.min(6, lida.times.length);
        await gravarConfig(
          n,
          lida.times.slice(0, n).map((t) => t.nome),
        );
        const total = await adicionarNomes(
          lida.times.slice(0, n).flatMap((t, i) => t.jogadores.map((nome) => ({ nome, time: i }))),
        );
        toast.success(`Lista já veio com ${n} times. ${total} jogadores novos no elenco.`);
      } else {
        const total = await adicionarNomes(lida.nomes.map((nome) => ({ nome, time: null })));
        toast.success(
          total === 0
            ? "Todo mundo dessa lista já estava no elenco."
            : `${total} ${total === 1 ? "jogador entrou" : "jogadores entraram"} no elenco.`,
        );
      }
      setTexto("");
    } catch {
      toast.error("Não deu pra adicionar a lista. Confere a internet.");
    } finally {
      setOcupado(false);
    }
  }

  /** Quem já tem conta no Goating: entra na turma (se ainda não é) e no elenco de hoje. */
  async function adicionarConta(perfil: PerfilAchado) {
    setOcupado(true);
    try {
      let membro = membros.find((m) => m.user_id === perfil.id);
      if (!membro) {
        const { data: criado, error } = await supabase
          .from("crew_members")
          .insert({ crew_id: crewId, user_id: perfil.id, nome: perfil.nome_exibicao })
          .select("*")
          .single();
        if (error) throw error;
        membro = criado;
        setMembros((atuais) => [...atuais, criado]);
      }
      const novo: JogadorDoDia = {
        memberId: membro.id,
        userId: perfil.id,
        nome: membro.nome,
        posicao: membro.posicao ?? perfil.posicao_preferida,
        estrelas:
          membro.estrelas ??
          estrelasDoOverall(perfil.overall, perfil.avaliacoes_recebidas) ??
          ESTRELAS_PADRAO,
        overall: overallDoPerfil(perfil),
        time: null,
      };
      setConfirmadosFora((fora) => fora.filter((f) => f.memberId !== novo.memberId));
      await gravarTimes([...jogadores.filter((j) => j.memberId !== novo.memberId), novo]);
      toast.success(`${novo.nome} entrou no elenco.`);
    } catch {
      toast.error("Não deu pra adicionar esse jogador.");
    } finally {
      setOcupado(false);
    }
  }

  async function adicionarConfirmados() {
    const fora = confirmadosFora;
    setConfirmadosFora([]);
    await gravarTimes([...jogadores, ...fora]);
  }

  async function compartilharTimes() {
    const resultado = await compartilhar(textoDosTimes(pelada.titulo, nomes, times));
    if (resultado === "copiado") toast.success("Times copiados. Cola no grupo!");
  }

  async function iniciar() {
    await queryClient.invalidateQueries({ queryKey: ["placar", id] });
    await navigate({ to: "/pelada/$id/placar", params: { id } });
  }

  return (
    <div className="app-shell flex min-h-dvh flex-col">
      <header className="bg-primary px-4 pt-4 pb-5">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Voltar" onClick={voltar}>
            <ArrowLeft className="size-5 text-primary-foreground" />
          </button>
          <span className="text-xs font-semibold tracking-wide text-mint uppercase">
            Montar os times
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-primary-foreground">{pelada.titulo}</h1>
        <p className="mt-1 text-sm text-mint">
          {jogadores.length} {jogadores.length === 1 ? "jogador" : "jogadores"} no elenco de hoje
        </p>
      </header>

      <div className="space-y-5 p-4">
        <section className="space-y-2 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <ClipboardPaste className="size-4 text-primary" /> Colar lista do WhatsApp
          </h2>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            placeholder={
              "1- João\n2- Pedrinho\n3- Carlão\n\nOu um nome só, pra quem chegou depois."
            }
          />
          <Button
            variant="secondary"
            className="w-full"
            disabled={ocupado || !texto.trim()}
            onClick={adicionarDaLista}
          >
            Adicionar ao elenco
          </Button>
          <BuscaJogador
            ignorar={jogadores.flatMap((j) => (j.userId ? [j.userId] : []))}
            ocupado={ocupado}
            onEscolher={adicionarConta}
          />
          {confirmadosFora.length > 0 && (
            <Button variant="outline" className="w-full" onClick={adicionarConfirmados}>
              Trazer {confirmadosFora.length} confirmado{confirmadosFora.length === 1 ? "" : "s"}{" "}
              que {confirmadosFora.length === 1 ? "falta" : "faltam"}
            </Button>
          )}
        </section>

        {jogadores.length > 0 && (
          <section>
            <h2 className="mb-1 text-sm font-bold text-foreground">Elenco ({jogadores.length})</h2>
            <div className="mb-2 flex gap-1 rounded-xl bg-foreground/[0.06] p-1">
              {(
                [
                  { id: "estrelas", rotulo: "Equilibrar por estrelas" },
                  { id: "overall", rotulo: "Equilibrar por overall" },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={base === o.id}
                  disabled={o.id === "overall" && comOverall === 0}
                  onClick={() => mudarBase(o.id)}
                  className={cn(
                    "flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors disabled:opacity-40",
                    base === o.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {o.rotulo}
                </button>
              ))}
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              {base === "estrelas"
                ? "Posição e estrelas equilibram o sorteio. Ficam salvas pra próxima pelada."
                : comOverall === jogadores.length
                  ? "Todo mundo tem overall liberado: o sorteio usa a nota do Goating."
                  : `${comOverall} de ${jogadores.length} têm overall liberado. Pros outros valem as estrelas (cada estrela = 20).`}
              {base === "estrelas" &&
                comOverall === 0 &&
                " Ninguém aqui tem overall liberado ainda."}
            </p>
            <div className="divide-y divide-border rounded-2xl bg-card shadow-[var(--shadow-card)]">
              {[...jogadores]
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map((j) => (
                  <div key={j.memberId} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {j.nome}
                    </span>
                    <select
                      aria-label={`Posição de ${j.nome}`}
                      value={j.posicao ?? ""}
                      onChange={(e) =>
                        atualizarMembro(j.memberId, { posicao: e.target.value || null })
                      }
                      className="h-8 rounded-lg border border-input bg-background px-1 text-xs font-bold text-foreground"
                    >
                      <option value="">—</option>
                      {POSICOES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    {base === "overall" && j.overall !== null ? (
                      <span
                        className="w-[110px] text-right text-base font-extrabold text-primary tabular-nums"
                        aria-label={`Overall de ${j.nome}`}
                      >
                        {j.overall}
                      </span>
                    ) : (
                      <div className="flex" role="group" aria-label={`Estrelas de ${j.nome}`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            aria-label={`${n} estrela${n === 1 ? "" : "s"}`}
                            onClick={() => atualizarMembro(j.memberId, { estrelas: n })}
                            className="p-0.5"
                          >
                            <Star
                              className={cn(
                                "size-5",
                                n <= j.estrelas ? "fill-tier-ouro text-tier-ouro" : "text-border",
                              )}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      aria-label={`Tirar ${j.nome} do elenco`}
                      onClick={() => remover(j.memberId)}
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
            </div>
          </section>
        )}

        {jogadores.length >= 2 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">Times</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Menos times"
                  disabled={numTimes <= 2}
                  onClick={() => mudarNumTimes(numTimes - 1)}
                  className="flex size-8 items-center justify-center rounded-lg bg-secondary disabled:opacity-40"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-16 text-center text-sm font-extrabold">{numTimes} times</span>
                <button
                  type="button"
                  aria-label="Mais times"
                  disabled={numTimes >= 6}
                  onClick={() => mudarNumTimes(numTimes + 1)}
                  className="flex size-8 items-center justify-center rounded-lg bg-secondary disabled:opacity-40"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            <Button variant={temTimes ? "outline" : "default"} className="w-full" onClick={sortear}>
              <Shuffle className="mr-2 size-4" /> {temTimes ? "Sortear de novo" : "Sortear times"}
            </Button>

            {(temTimes || selecionado) && (
              <QuadroTimes
                jogadores={jogadores}
                numTimes={numTimes}
                nomes={nomes}
                base={base}
                selecionado={selecionado}
                onTocar={tocarJogador}
                onMover={moverJogador}
              />
            )}
          </section>
        )}
      </div>

      <div className="sticky bottom-0 mt-auto flex gap-2 border-t border-border bg-card p-4">
        <Button
          variant="outline"
          className="flex-1"
          disabled={!temTimes}
          onClick={compartilharTimes}
        >
          <Share2 className="mr-2 size-4" /> Compartilhar
        </Button>
        <Button className="flex-1" disabled={!prontoPraJogar} onClick={iniciar}>
          <Play className="mr-2 size-4" /> Iniciar partida
        </Button>
      </div>
    </div>
  );
}
