import { useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Link2,
  LogOut,
  Plus,
  Share2,
  Trophy,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { BuscaJogador, type PerfilAchado } from "@/components/goating/busca-jogador";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { compartilhar } from "@/lib/placar/dados";

type Aba = "ranking" | "peladas" | "membros";
type Periodo = "mes" | "ano" | "tudo";
type Criterio = "gols" | "vitorias" | "aproveitamento";

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

function PaginaDaTurma() {
  const { id } = useParams({ from: "/turma/$id" });
  const { aba: abaDaUrl } = useSearch({ from: "/turma/$id" });
  const { userId, carregando } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const aba = abaDaUrl ?? "ranking";
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [criterio, setCriterio] = useState<Criterio>("gols");
  const [ocupado, setOcupado] = useState(false);
  const [nomeNovo, setNomeNovo] = useState("");
  const [folha, setFolha] = useState<
    | { tipo: "entrar" }
    | { tipo: "sair" }
    | { tipo: "vincular"; memberId: string; nome: string }
    | null
  >(null);

  const turma = useQuery({
    queryKey: ["turma", id],
    enabled: !!userId,
    queryFn: async () => {
      const [turmaRes, membrosRes, peladasRes] = await Promise.all([
        supabase.from("crews").select("id, nome, dono_id").eq("id", id).maybeSingle(),
        supabase.from("crew_members").select("id, user_id, nome").eq("crew_id", id).order("nome"),
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

      // quem já jogou não pode ser apagado da turma (levaria o histórico junto)
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

  const ranking = useQuery({
    queryKey: ["turma-ranking", id, periodo],
    enabled: !!userId && aba === "ranking",
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
      <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
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
  const souMembro = dados.membros.some((m) => m.user_id === userId);
  const semConta = dados.membros.filter((m) => !m.user_id);
  const contasNaTurma = dados.membros.flatMap((m) => (m.user_id ? [m.user_id] : []));
  const link = `${window.location.origin}/turma/${id}`;

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

  const remover = (memberId: string, nome: string) =>
    executar(
      () => supabase.from("crew_members").delete().eq("id", memberId),
      `${nome} saiu da turma.`,
      "Não deu pra tirar esse jogador.",
    );

  async function convidar() {
    const resultado = await compartilhar(`Entra na turma "${dados.nome}" no Goating:\n${link}`);
    if (resultado === "copiado") toast.success("Link copiado. Manda no grupo!");
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
      `🏆 ${dados.nome} · ${rotulo} · ${rotuloPeriodo}`,
      "",
      ...linhas.slice(0, 10).map((l, i) => `${medalhas[i] ?? `${i + 1}.`} ${l.nome}: ${valor(l)}`),
    ].join("\n");
    const resultado = await compartilhar(texto);
    if (resultado === "copiado") toast.success("Ranking copiado. Cola no grupo!");
  }

  const hoje = new Date().toLocaleDateString("sv-SE");
  const proximas = dados.peladas
    .filter((p) => p.status !== "finalizada" && p.status !== "cancelada" && p.data >= hoje)
    .reverse();
  const passadas = dados.peladas.filter((p) => p.status === "finalizada");

  return (
    <div className="app-shell flex min-h-screen flex-col pb-28">
      <header className="bg-primary px-4 pt-4 pb-5">
        <div className="flex items-center gap-3">
          <Link to="/turmas" aria-label="Voltar">
            <ArrowLeft className="size-5 text-primary-foreground" />
          </Link>
          <span className="flex-1 text-xs font-semibold tracking-wide text-mint uppercase">
            Turma
          </span>
          <button
            type="button"
            onClick={convidar}
            className="flex items-center gap-1.5 rounded-full bg-mint/15 px-3 py-1.5 text-xs font-semibold text-mint"
          >
            <Link2 className="size-4" /> Convidar
          </button>
        </div>
        <h1 className="mt-3 text-2xl font-extrabold text-primary-foreground">{dados.nome}</h1>
        <p className="mt-1 text-sm text-mint">
          {dados.membros.length} {dados.membros.length === 1 ? "jogador" : "jogadores"} ·{" "}
          {passadas.length} {passadas.length === 1 ? "pelada" : "peladas"}
        </p>
      </header>

      <div className="space-y-3 p-4">
        {!souMembro && !souDono && (
          <Button
            className="w-full bg-mint font-semibold text-mint-foreground hover:bg-mint/90"
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
            <Abas opcoes={CRITERIOS} valor={criterio} onMudar={setCriterio} />
            {ranking.isLoading ? (
              <Skeleton className="h-64 w-full rounded-2xl" />
            ) : linhas.length === 0 ? (
              <Vazio>Nenhuma pelada com placar nesse período ainda.</Vazio>
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
                          {l.user_id === userId && (
                            <span className="text-muted-foreground"> (você)</span>
                          )}
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
          </>
        )}

        {aba === "peladas" && (
          <>
            {souDono && (
              <Button
                asChild
                className="w-full bg-mint font-semibold text-mint-foreground hover:bg-mint/90"
              >
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
            {souDono && (
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
                          : m.user_id
                            ? "Com conta"
                            : "Sem conta"}
                      </span>
                    </span>
                    {m.user_id && m.user_id !== userId && (
                      <Link
                        to="/jogador/$id"
                        params={{ id: m.user_id }}
                        className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                      >
                        Perfil
                      </Link>
                    )}
                    {souDono && !m.user_id && (
                      <button
                        type="button"
                        onClick={() => setFolha({ tipo: "vincular", memberId: m.id, nome: m.nome })}
                        className="rounded-lg border border-border px-2 py-1 text-xs font-semibold"
                      >
                        Vincular conta
                      </button>
                    )}
                    {souDono && !m.jaJogou && m.user_id !== userId && (
                      <button
                        type="button"
                        aria-label={`Tirar ${m.nome} da turma`}
                        disabled={ocupado}
                        onClick={() => remover(m.id, m.nome)}
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
          <Button className="w-full" onClick={compartilharRanking}>
            <Share2 className="mr-2 size-4" /> Compartilhar ranking
          </Button>
        </div>
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
