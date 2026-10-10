import { useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Image as ImageIcon,
  Link2,
  LogOut,
  Pencil,
  Plus,
  Settings,
  Share2,
  Trophy,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { PERIODOS, rotuloDoPeriodo, useRankingDaTurma, type Periodo } from "@/hooks/use-turmas";
import { useVoltar } from "@/hooks/use-voltar";
import { BuscaJogador, type PerfilAchado } from "@/components/goating/busca-jogador";
import { ConfigTurma } from "@/components/goating/config-turma";
import { FolhaNome } from "@/components/goating/folha-nome";
import {
  COLUNAS_RANKING,
  TabelaRanking,
  formatarMedia,
  type ColunaRanking,
} from "@/components/goating/tabela-ranking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { compartilhar } from "@/lib/placar/dados";
import { compartilharRanking } from "@/lib/placar/poster";
import { urlDaFotoDaTurma } from "@/lib/foto-turma";
import { origemDoSite } from "@/lib/site";

type Aba = "ranking" | "peladas" | "membros";

export const Route = createFileRoute("/turma/$id")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { aba?: Aba | undefined } => ({
    aba:
      search["aba"] === "peladas" ? "peladas" : search["aba"] === "membros" ? "membros" : undefined,
  }),
  head: () => ({ meta: [{ title: "Turma · Goating" }] }),
  component: PaginaDaTurma,
});

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "ranking", rotulo: "Ranking" },
  { id: "peladas", rotulo: "Peladas" },
  { id: "membros", rotulo: "Jogadores" },
];

function PaginaDaTurma() {
  const { id } = useParams({ from: "/turma/$id" });
  const { aba: abaDaUrl } = useSearch({ from: "/turma/$id" });
  const { userId, carregando } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const voltar = useVoltar(() => void navigate({ to: "/turmas" }));
  const aba = abaDaUrl ?? "ranking";
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [ordem, setOrdem] = useState<ColunaRanking>("gols");
  const [gerandoImagem, setGerandoImagem] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [renomeando, setRenomeando] = useState<{ memberId: string; nome: string } | null>(null);
  const [nomeNovo, setNomeNovo] = useState("");
  const [nomeConfirmado, setNomeConfirmado] = useState("");
  const [folha, setFolha] = useState<
    | { tipo: "entrar" }
    | { tipo: "sair" }
    | { tipo: "excluir" }
    | { tipo: "config" }
    | { tipo: "vincular"; memberId: string; nome: string }
    | { tipo: "remover"; memberId: string; nome: string; jaJogou: boolean }
    | null
  >(null);

  const turma = useQuery({
    queryKey: ["turma", id],
    enabled: !!userId,
    queryFn: async () => {
      const [turmaRes, membrosRes, peladasRes] = await Promise.all([
        supabase
          .from("crews")
          .select("id, nome, dono_id, escudo_url, capa_url")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("crew_members")
          .select("id, user_id, nome, admin")
          .eq("crew_id", id)
          .is("removido_em", null)
          .order("nome"),
        supabase
          .from("matches")
          .select("id, titulo, data, horario, status, placar_finalizado_em")
          .eq("crew_id", id)
          .order("data", { ascending: false })
          .order("horario", { ascending: false }),
      ]);
      if (turmaRes.error) throw turmaRes.error;
      if (membrosRes.error) throw membrosRes.error;
      if (peladasRes.error) throw peladasRes.error;
      if (!turmaRes.data) return null;

      // quem já jogou sai da turma mas as peladas antigas continuam com ele; o aviso muda
      const ids = membrosRes.data.map((m) => m.id);
      const { data: comJogo } = ids.length
        ? await supabase.from("match_players").select("member_id").in("member_id", ids)
        : { data: [] };
      const jaJogou = new Set((comJogo ?? []).map((l) => l.member_id));

      return {
        ...turmaRes.data,
        membros: membrosRes.data.map((m) => ({ ...m, jaJogou: jaJogou.has(m.id) })),
        peladas: peladasRes.data,
      };
    },
  });

  const ranking = useRankingDaTurma(id, periodo, !!userId && aba === "ranking");

  if (carregando || (!!userId && turma.isLoading)) {
    return (
      <div className="app-shell space-y-3 p-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }
  if (!userId || !turma.data) {
    return (
      <div className="app-shell flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {userId
            ? "Essa turma não existe mais."
            : "Entre na sua conta para ver a turma e entrar nela."}
        </p>
        <Button asChild>
          {userId ? (
            <Link to="/turmas">Minhas turmas</Link>
          ) : (
            <Link to="/auth" search={{ turma: id }}>
              Entrar no Goating
            </Link>
          )}
        </Button>
      </div>
    );
  }

  const dados = turma.data;
  const souDono = dados.dono_id === userId;
  const finalizadas = dados.peladas.filter((p) => p.status === "finalizada").length;
  const porJogar = dados.peladas.length - finalizadas;
  const souMembro = dados.membros.some((m) => m.user_id === userId);
  // dono e administradores cuidam da lista de jogadores e das peladas
  const souGestor = souDono || dados.membros.some((m) => m.user_id === userId && m.admin);
  const semConta = dados.membros.filter((m) => !m.user_id);
  const contasNaTurma = dados.membros.flatMap((m) => (m.user_id ? [m.user_id] : []));
  const link = `${origemDoSite()}/turma/${id}`;

  async function recarregar() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["turma", id] }),
      queryClient.invalidateQueries({ queryKey: ["turma-ranking", id] }),
      queryClient.invalidateQueries({ queryKey: ["minhas-turmas-resumo"] }),
    ]);
  }

  /** Roda uma ação no banco com o botão travado e o aviso certo no final. */
  async function executar(
    acao: () => PromiseLike<{ error: { message: string } | null }>,
    sucesso: string,
    falha: string,
  ) {
    setOcupado(true);
    const { error } = await acao();
    setOcupado(false);
    if (error) {
      // mensagens das funções do banco já vêm em português e explicam o motivo
      toast.error(/[áéíóúãõç]/i.test(error.message) ? error.message : falha);
      return false;
    }
    toast.success(sucesso);
    setFolha(null);
    await recarregar();
    return true;
  }

  const entrar = (memberId?: string) =>
    executar(
      () =>
        supabase.rpc("entrar_na_turma", {
          p_crew_id: id,
          ...(memberId ? { p_member_id: memberId } : {}),
        }),
      "Você entrou na turma!",
      "Não deu pra entrar na turma.",
    );

  const sair = () =>
    executar(
      () => supabase.rpc("sair_da_turma", { p_crew_id: id }),
      "Você saiu da turma.",
      "Não deu pra sair da turma.",
    );

  async function excluirTurma() {
    setOcupado(true);
    const { error } = await supabase.rpc("excluir_turma", { p_crew_id: id });
    setOcupado(false);
    if (error) {
      toast.error(
        /[áéíóúãõç]/i.test(error.message) ? error.message : "Não deu pra excluir a turma.",
      );
      return;
    }
    toast.success("Turma excluída.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["minhas-turmas-resumo"] }),
      queryClient.invalidateQueries({ queryKey: ["minhas-turmas"] }),
      queryClient.invalidateQueries({ queryKey: ["feed"] }),
    ]);
    await navigate({ to: "/turmas", replace: true });
  }

  const adicionarConta = (perfil: PerfilAchado) =>
    executar(
      () =>
        supabase
          .from("crew_members")
          .insert({ crew_id: id, user_id: perfil.id, nome: perfil.nome_exibicao }),
      `${perfil.nome_exibicao} entrou na turma.`,
      "Não deu pra adicionar esse jogador.",
    );

  async function adicionarNome() {
    const nome = nomeNovo.trim();
    if (!nome) return;
    const ok = await executar(
      () => supabase.from("crew_members").insert({ crew_id: id, nome }),
      `${nome} entrou na turma.`,
      "Não deu pra adicionar esse jogador.",
    );
    if (ok) setNomeNovo("");
  }

  const vincular = (memberId: string, perfil: PerfilAchado) =>
    executar(
      () => supabase.rpc("vincular_membro", { p_member_id: memberId, p_user_id: perfil.id }),
      `Histórico ligado à conta de ${perfil.nome_exibicao}.`,
      "Não deu pra vincular.",
    );

  const renomear = (memberId: string, nome: string) =>
    executar(
      () => supabase.from("crew_members").update({ nome }).eq("id", memberId),
      "Nome corrigido.",
      "Não deu pra mudar o nome.",
    );

  const remover = (memberId: string, nome: string) =>
    executar(
      () => supabase.rpc("remover_da_turma", { p_member_id: memberId }),
      `${nome} saiu da turma.`,
      "Não deu pra tirar esse jogador.",
    );

  const definirAdmin = (memberId: string, nome: string, admin: boolean) =>
    executar(
      () => supabase.rpc("definir_admin", { p_member_id: memberId, p_admin: admin }),
      admin ? `${nome} agora é administrador da turma.` : `${nome} não é mais administrador.`,
      "Não deu pra mudar o administrador.",
    );

  async function convidar() {
    const resultado = await compartilhar(`Entra na turma "${dados.nome}" no Goating:\n${link}`);
    if (resultado === "copiado") toast.success("Link copiado. Manda no grupo!");
  }

  const linhas = [...(ranking.data ?? [])].sort(
    (a, b) =>
      b[ordem] - a[ordem] ||
      b.gols - a.gols ||
      b.vitorias - a.vitorias ||
      a.nome.localeCompare(b.nome),
  );
  const rotuloPeriodo = rotuloDoPeriodo(periodo);
  const colunaOrdenada = COLUNAS_RANKING.find((c) => c.id === ordem);

  /** Texto pro WhatsApp: um jogador por bloco, com todos os números. */
  async function compartilharTexto() {
    const medalhas = ["🥇", "🥈", "🥉"];
    const texto = [
      `🏆 *${dados.nome}*`,
      `Ranking de ${rotuloPeriodo}, por ${colunaOrdenada?.nome ?? "gols"}`,
      "",
      ...linhas
        .slice(0, 15)
        .flatMap((l, i) => [
          `${medalhas[i] ?? `${i + 1}.`} *${l.nome}*`,
          `   ${l.jogos} ${l.jogos === 1 ? "jogo" : "jogos"} · ${l.vitorias} ${l.vitorias === 1 ? "vitória" : "vitórias"} · ${l.gols} ${l.gols === 1 ? "gol" : "gols"} · ${formatarMedia(l.media)} por jogo · ${l.aproveitamento}%`,
        ]),
    ].join("\n");
    const resultado = await compartilhar(texto);
    if (resultado === "copiado") toast.success("Ranking copiado. Cola no grupo!");
  }

  async function compartilharTabela() {
    setGerandoImagem(true);
    try {
      const resultado = await compartilharRanking(
        {
          turma: dados.nome,
          periodo: rotuloPeriodo,
          colunaOrdenada: COLUNAS_RANKING.findIndex((c) => c.id === ordem),
          linhas: linhas.map((l) => ({
            nome: l.nome,
            jogos: l.jogos,
            vitorias: l.vitorias,
            gols: l.gols,
            media: formatarMedia(l.media),
            aproveitamento: l.aproveitamento,
          })),
        },
        "goating-ranking.png",
      );
      if (resultado === "baixado") toast.success("Tabela baixada. Manda no grupo!");
    } catch {
      toast.error("Não deu pra gerar a tabela.");
    } finally {
      setGerandoImagem(false);
    }
  }

  const escudo = urlDaFotoDaTurma(dados.escudo_url);
  const capa = urlDaFotoDaTurma(dados.capa_url);

  const hoje = new Date().toLocaleDateString("sv-SE");
  const proximas = dados.peladas
    .filter((p) => p.status !== "finalizada" && p.status !== "cancelada" && p.data >= hoje)
    .reverse();
  const passadas = dados.peladas.filter((p) => p.status === "finalizada");

  return (
    <div className="app-shell flex min-h-dvh flex-col">
      <header className="relative isolate overflow-hidden bg-primary px-4 pt-4 pb-5">
        {/* capa no fundo, escurecida pra o texto continuar legível por cima de qualquer foto */}
        {capa && (
          <>
            <img src={capa} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/25 to-black/80" />
          </>
        )}
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Voltar" onClick={voltar}>
            <ArrowLeft className="size-5 text-primary-foreground" />
          </button>
          <span
            className={cn(
              "ml-1 flex-1 text-xs font-semibold tracking-wide uppercase",
              capa ? "text-white/80" : "text-mint",
            )}
          >
            Turma
          </span>
          <button
            type="button"
            onClick={convidar}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
              capa ? "bg-black/45 text-white" : "bg-mint/15 text-mint",
            )}
          >
            <Link2 className="size-4" /> Convidar
          </button>
          {souGestor && (
            <button
              type="button"
              aria-label="Configurações da turma"
              onClick={() => setFolha({ tipo: "config" })}
              className={cn(
                "flex size-8 items-center justify-center rounded-full",
                capa ? "bg-black/45 text-white" : "bg-mint/15 text-mint",
              )}
            >
              <Settings className="size-4" />
            </button>
          )}
        </div>
        <div className={cn("flex items-end gap-3", capa ? "mt-20" : "mt-4")}>
          <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/85 bg-primary shadow-lg">
            {escudo ? (
              <img src={escudo} alt="" className="size-full object-cover" />
            ) : (
              <Users className="size-7 text-mint" />
            )}
          </span>
          <div className="min-w-0 pb-0.5">
            <h1 className="truncate text-2xl leading-tight font-extrabold text-primary-foreground">
              {dados.nome}
            </h1>
            <p className={cn("mt-0.5 text-sm", capa ? "text-white/85" : "text-mint")}>
              {dados.membros.length} {dados.membros.length === 1 ? "jogador" : "jogadores"} ·{" "}
              {passadas.length} {passadas.length === 1 ? "pelada" : "peladas"}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-3 p-4">
        {!souMembro && !souDono && (
          <Button
            className="w-full"
            disabled={ocupado}
            onClick={() => (semConta.length > 0 ? setFolha({ tipo: "entrar" }) : void entrar())}
          >
            <UserPlus className="mr-2 size-4" /> Entrar na turma
          </Button>
        )}

        <Abas
          opcoes={ABAS}
          valor={aba}
          onMudar={(nova) =>
            void navigate({
              to: "/turma/$id",
              params: { id },
              search: nova === "ranking" ? {} : { aba: nova },
              replace: true,
            })
          }
        />

        {aba === "ranking" && (
          <>
            <Abas opcoes={PERIODOS} valor={periodo} onMudar={setPeriodo} />
            {ranking.isLoading ? (
              <Skeleton className="h-64 w-full rounded-2xl" />
            ) : linhas.length === 0 ? (
              <Vazio>Nenhuma pelada com placar nesse período ainda.</Vazio>
            ) : (
              <TabelaRanking linhas={linhas} ordem={ordem} onOrdenar={setOrdem} userId={userId} />
            )}
          </>
        )}

        {aba === "peladas" && (
          <>
            {souGestor && (
              <Button asChild className="w-full">
                <Link to="/criar" search={{ turma: id }}>
                  <Plus className="mr-2 size-4" /> Criar pelada dessa turma
                </Link>
              </Button>
            )}
            {proximas.length === 0 && passadas.length === 0 && (
              <Vazio>Essa turma ainda não tem pelada.</Vazio>
            )}
            {proximas.length > 0 && (
              <ListaPeladas titulo="Próximas" peladas={proximas} destino="pelada" />
            )}
            {passadas.length > 0 && (
              <ListaPeladas titulo="Já rolaram" peladas={passadas} destino="resumo" />
            )}
          </>
        )}

        {aba === "membros" && (
          <>
            {souGestor && (
              <section className="space-y-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
                <h2 className="text-sm font-bold text-foreground">Chamar a galera</h2>
                <Button variant="outline" className="w-full" onClick={convidar}>
                  <Link2 className="mr-2 size-4" /> Mandar link da turma
                </Button>
                <p className="text-xs text-muted-foreground">
                  Quem abrir o link entra sozinho. Se já jogou como nome solto, escolhe o próprio
                  nome e leva o histórico.
                </p>
                <BuscaJogador
                  ignorar={contasNaTurma}
                  ocupado={ocupado}
                  onEscolher={adicionarConta}
                />
                <div className="flex gap-2">
                  <Input
                    value={nomeNovo}
                    onChange={(e) => setNomeNovo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void adicionarNome();
                    }}
                    placeholder="Ou só o nome, pra quem não tem conta"
                  />
                  <Button disabled={ocupado || !nomeNovo.trim()} onClick={adicionarNome}>
                    Adicionar
                  </Button>
                </div>
              </section>
            )}

            {dados.membros.length === 0 ? (
              <Vazio>Ninguém na turma ainda.</Vazio>
            ) : (
              <div className="divide-y divide-border rounded-2xl bg-card shadow-[var(--shadow-card)]">
                {dados.membros.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {m.nome}
                        {m.user_id === userId && (
                          <span className="text-muted-foreground"> (você)</span>
                        )}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {m.user_id === dados.dono_id
                          ? "Dono da turma"
                          : m.admin
                            ? "Administrador"
                            : m.user_id
                              ? "Com conta"
                              : "Sem conta"}
                      </span>
                    </span>
                    {souGestor && (
                      <button
                        type="button"
                        aria-label={`Corrigir o nome de ${m.nome}`}
                        onClick={() => setRenomeando({ memberId: m.id, nome: m.nome })}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                    {m.user_id && m.user_id !== userId && (
                      <Link
                        to="/jogador/$id"
                        params={{ id: m.user_id }}
                        className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                      >
                        Perfil
                      </Link>
                    )}
                    {souDono && m.user_id && m.user_id !== dados.dono_id && (
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => definirAdmin(m.id, m.nome, !m.admin)}
                        className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                      >
                        {m.admin ? "Tirar admin" : "Tornar admin"}
                      </button>
                    )}
                    {souGestor && !m.user_id && (
                      <button
                        type="button"
                        onClick={() => setFolha({ tipo: "vincular", memberId: m.id, nome: m.nome })}
                        className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                      >
                        Vincular conta
                      </button>
                    )}
                    {souGestor &&
                      m.user_id !== userId &&
                      m.user_id !== dados.dono_id &&
                      (souDono || !m.admin) && (
                        <button
                          type="button"
                          aria-label={`Tirar ${m.nome} da turma`}
                          disabled={ocupado}
                          onClick={() =>
                            setFolha({
                              tipo: "remover",
                              memberId: m.id,
                              nome: m.nome,
                              jaJogou: m.jaJogou,
                            })
                          }
                          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                  </div>
                ))}
              </div>
            )}

            {souMembro && !souDono && (
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => setFolha({ tipo: "sair" })}
              >
                <LogOut className="mr-2 size-4" /> Sair da turma
              </Button>
            )}
          </>
        )}
      </div>

      {aba === "ranking" && linhas.length > 0 && (
        <div className="sticky bottom-0 mt-auto border-t border-border bg-card p-4">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={compartilharTexto}>
              <Share2 className="mr-2 size-4" /> Texto
            </Button>
            <Button
              variant={souMembro || souDono ? "default" : "outline"}
              className="flex-[2]"
              disabled={gerandoImagem}
              onClick={compartilharTabela}
            >
              <ImageIcon className="mr-2 size-4" />{" "}
              {gerandoImagem ? "Gerando…" : "Compartilhar tabela"}
            </Button>
          </div>
        </div>
      )}

      {renomeando && (
        <FolhaNome
          nomeAtual={renomeando.nome}
          onSalvar={(nome) => renomear(renomeando.memberId, nome)}
          onFechar={() => setRenomeando(null)}
        />
      )}

      {folha?.tipo === "entrar" && (
        <Folha titulo="Você já jogou nessa turma?" onFechar={() => setFolha(null)}>
          <p className="text-sm text-muted-foreground">
            Se um desses nomes é você, toque nele: gols e vitórias passam pra sua conta.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {semConta.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={ocupado}
                onClick={() => entrar(m.id)}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm font-semibold"
              >
                {m.nome}
              </button>
            ))}
          </div>
          <Button className="w-full" disabled={ocupado} onClick={() => entrar()}>
            Não, sou novo aqui
          </Button>
        </Folha>
      )}

      {folha?.tipo === "vincular" && (
        <Folha titulo={`De quem é a conta de ${folha.nome}?`} onFechar={() => setFolha(null)}>
          <p className="text-sm text-muted-foreground">
            O histórico de {folha.nome} nessa turma passa pra conta escolhida.
          </p>
          <BuscaJogador
            ignorar={[]}
            rotuloAcao="É essa"
            ocupado={ocupado}
            onEscolher={(perfil) => vincular(folha.memberId, perfil)}
          />
        </Folha>
      )}

      {folha?.tipo === "remover" && (
        <Folha titulo={`Tirar ${folha.nome} da turma?`} onFechar={() => setFolha(null)}>
          <p className="text-sm text-muted-foreground">
            {folha.jaJogou
              ? "Sai da lista de jogadores e do ranking. As peladas que já aconteceram continuam como foram. Se o nome voltar numa lista, o jogador volta pra turma com os gols e vitórias que tinha."
              : "Esse jogador ainda não jogou nenhuma pelada da turma: sai sem deixar nada pra trás."}
          </p>
          <Button
            variant="destructive"
            className="w-full"
            disabled={ocupado}
            onClick={() => remover(folha.memberId, folha.nome)}
          >
            Tirar da turma
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setFolha(null)}>
            Cancelar
          </Button>
        </Folha>
      )}

      {folha?.tipo === "config" && (
        <ConfigTurma
          turma={dados}
          souDono={souDono}
          onMudou={recarregar}
          onExcluir={() => {
            setNomeConfirmado("");
            setFolha({ tipo: "excluir" });
          }}
          onFechar={() => setFolha(null)}
        />
      )}

      {folha?.tipo === "excluir" && (
        <Folha titulo="Excluir a turma?" onFechar={() => setFolha(null)}>
          <p className="text-sm text-muted-foreground">
            A turma some do app, com o ranking e a lista de jogadores, e não dá pra desfazer.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              {finalizadas === 0
                ? "Nenhuma pelada já jogada pra guardar."
                : `${finalizadas} ${finalizadas === 1 ? "pelada já jogada continua" : "peladas já jogadas continuam"} no histórico de quem jogou, com placar, gols, avaliações e XP.`}
            </li>
            <li>
              {porJogar === 0
                ? "Nenhuma pelada agendada pra apagar."
                : `${porJogar} ${porJogar === 1 ? "pelada que ainda não aconteceu é apagada" : "peladas que ainda não aconteceram são apagadas"}.`}
            </li>
          </ul>
          <p className="text-sm text-foreground">
            Pra confirmar, escreva o nome da turma: <span className="font-bold">{dados.nome}</span>
          </p>
          <Input
            value={nomeConfirmado}
            onChange={(e) => setNomeConfirmado(e.target.value)}
            aria-label="Nome da turma"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <Button
            variant="destructive"
            className="w-full"
            disabled={
              ocupado || nomeConfirmado.trim().toLowerCase() !== dados.nome.trim().toLowerCase()
            }
            onClick={excluirTurma}
          >
            Excluir turma
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setFolha(null)}>
            Cancelar
          </Button>
        </Folha>
      )}

      {folha?.tipo === "sair" && (
        <Folha titulo="Sair da turma?" onFechar={() => setFolha(null)}>
          <p className="text-sm text-muted-foreground">
            A turma some da sua lista. Seus gols e vitórias continuam no ranking dela, só com o
            nome.
          </p>
          <Button variant="destructive" className="w-full" disabled={ocupado} onClick={sair}>
            Sair da turma
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setFolha(null)}>
            Ficar
          </Button>
        </Folha>
      )}
    </div>
  );
}

function ListaPeladas({
  titulo,
  peladas,
  destino,
}: {
  titulo: string;
  peladas: {
    id: string;
    titulo: string;
    data: string;
    horario: string;
    placar_finalizado_em: string | null;
  }[];
  destino: "pelada" | "resumo";
}) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
        {titulo}
      </h2>
      <div className="divide-y divide-border rounded-2xl bg-card shadow-[var(--shadow-card)]">
        {peladas.map((p) => {
          const comPlacar = destino === "resumo" && !!p.placar_finalizado_em;
          return (
            <Link
              key={p.id}
              to={comPlacar ? "/pelada/$id/resumo" : "/pelada/$id"}
              params={{ id: p.id }}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              {comPlacar ? (
                <Trophy className="size-4 shrink-0 text-tier-ouro" />
              ) : (
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {p.titulo}
                </span>
                <span className="block text-[11px] text-muted-foreground capitalize">
                  {new Date(`${p.data}T12:00:00`).toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  })}{" "}
                  · {p.horario.slice(0, 5)}
                </span>
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                {comPlacar ? "Ver placar" : destino === "resumo" ? "Sem placar" : "Abrir"}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Vazio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
      {children}
    </p>
  );
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
