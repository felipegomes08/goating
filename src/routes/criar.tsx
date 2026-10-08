import { useState } from "react";
import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Lock, Minus, Plus, Repeat, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePerfil } from "@/hooks/use-session";
import { CampoHorario } from "@/components/goating/campo-horario";
import { CidadeCombobox } from "@/components/goating/cidade-combobox";
import {
  CONFIG_PADRAO,
  ConfigJogoCampos,
  configParaPelada,
  type ConfigJogo,
} from "@/components/goating/config-jogo";
import { chaveNome } from "@/lib/placar/lista";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function somarHora(hhmm: string, horas: number) {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const total = (((h * 60 + m + horas * 60) % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export const Route = createFileRoute("/criar")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { turma?: string | undefined } => ({
    turma: typeof search["turma"] === "string" ? search["turma"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Criar pelada · Goating" },
      {
        name: "description",
        content: "Monte sua pelada em menos de um minuto e chame a galera pelo link de convite.",
      },
      { property: "og:title", content: "Criar pelada no Goating" },
      {
        property: "og:description",
        content: "Organize sua pelada e reúna os jogadores da cidade.",
      },
    ],
  }),
  component: CriarPelada,
});

function CriarPelada() {
  const navigate = useNavigate();
  const { userId, carregando } = useSession();
  const { data: perfil } = usePerfil(userId);

  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("19:30");
  const [horarioFim, setHorarioFim] = useState(somarHora("19:30", 1));
  const [horarioFimTocado, setHorarioFimTocado] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [local, setLocal] = useState("");
  const [cidade, setCidade] = useState("");
  const [vagas, setVagas] = useState(10);
  const [tipo, setTipo] = useState<"aberta" | "fechada">("aberta");
  const [recorrente, setRecorrente] = useState(false);
  const [repeticoes, setRepeticoes] = useState(4);
  const [enviando, setEnviando] = useState(false);
  /** "agora": já tenho a lista do WhatsApp e quero ir direto pros times e pro placar. */
  const [modo, setModo] = useState<"agendar" | "agora">("agendar");
  const [config, setConfig] = useState<ConfigJogo>(CONFIG_PADRAO);
  const { turma: turmaDaUrl } = useSearch({ from: "/criar" });
  const [turmaManual, setTurmaManual] = useState<string | null>(turmaDaUrl ?? null);

  const turmas = useQuery({
    queryKey: ["minhas-turmas", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("minhas_turmas");
      if (error) throw error;
      // só dá pra criar pelada em turma que eu gero
      return data
        .filter((t) => t.sou_dono || t.sou_admin)
        .map((t) => ({ id: t.crew_id, nome: t.nome }));
    },
  });
  const [criada, setCriada] = useState<{
    id: string;
    titulo: string;
    cidade: string;
    token: string;
    total: number;
  } | null>(null);

  if (!carregando && !userId) {
    navigate({ to: "/auth", replace: true });
  }

  const cidadeFinal = cidade || perfil?.cidade || "";
  const valido =
    modo === "agora"
      ? !!titulo.trim()
      : titulo.trim() && data && horario && local.trim() && cidadeFinal.trim();

  // As estatísticas somam por turma: mesmo título de antes cai na mesma turma.
  const turmaDoTitulo = (turmas.data ?? []).find((t) => chaveNome(t.nome) === chaveNome(titulo));
  const turmaEscolhida = turmaManual ?? turmaDoTitulo?.id ?? "nova";

  const DIAS = [
    "todo domingo",
    "toda segunda",
    "toda terça",
    "toda quarta",
    "toda quinta",
    "toda sexta",
    "todo sábado",
  ];
  const diaSemana = data ? DIAS[new Date(`${data}T12:00:00`).getDay()] : null;

  function somarSemanas(iso: string, semanas: number) {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + semanas * 7);
    return d.toISOString().slice(0, 10);
  }

  async function criar() {
    if (!valido || !userId) return;
    setEnviando(true);
    try {
      const agora = new Date();
      const hoje = agora.toLocaleDateString("sv-SE");
      const horaAgora = agora.toTimeString().slice(0, 5);
      const total = modo === "agendar" && recorrente ? repeticoes : 1;
      const datas =
        modo === "agora" ? [hoje] : Array.from({ length: total }, (_, i) => somarSemanas(data, i));

      let crewId = turmaEscolhida;
      if (crewId === "nova") {
        const { data: turma, error: erroTurma } = await supabase
          .from("crews")
          .insert({ dono_id: userId, nome: titulo.trim() })
          .select("id")
          .single();
        if (erroTurma) throw erroTurma;
        crewId = turma.id;
      }

      const { data: peladas, error } = await supabase
        .from("matches")
        .insert(
          datas.map((d) => ({
            organizador_id: userId,
            titulo: titulo.trim(),
            crew_id: crewId,
            ...configParaPelada(config),
            ...(modo === "agora"
              ? {
                  data: d,
                  horario: horaAgora,
                  horario_fim: somarHora(horaAgora, 2),
                  local: local.trim() || "A combinar",
                  cidade: cidadeFinal.trim() || "—",
                  quantidade_vagas: 30,
                  tipo: "fechada",
                }
              : {
                  data: d,
                  horario,
                  horario_fim: horarioFim,
                  descricao: descricao.trim() || null,
                  local: local.trim(),
                  cidade: cidadeFinal.trim(),
                  quantidade_vagas: vagas,
                  tipo,
                }),
          })),
        )
        .select();
      if (error) throw error;

      await supabase.from("match_participants").insert(
        peladas.map((p) => ({
          match_id: p.id,
          user_id: userId,
          status: "aprovado",
        })),
      );

      const links = peladas.map((p) => ({
        match_id: p.id,
        token: crypto.randomUUID().replaceAll("-", "").slice(0, 10),
      }));
      await supabase.from("match_invite_links").insert(links);

      const primeira = peladas[0];
      if (!primeira || !links[0]) throw new Error("Não deu para criar a pelada.");
      if (modo === "agora") {
        // já sai do feed: ninguém vai confirmar presença, a lista vem colada
        await supabase.from("matches").update({ status: "em_andamento" }).eq("id", primeira.id);
        await navigate({ to: "/pelada/$id/times", params: { id: primeira.id } });
        return;
      }
      setCriada({
        id: primeira.id,
        titulo: primeira.titulo,
        cidade: primeira.cidade,
        token: links[0].token,
        total: peladas.length,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não deu para criar a pelada.");
    } finally {
      setEnviando(false);
    }
  }

  if (criada) {
    const link = `${window.location.origin}/p/${criada.token}`;
    return (
      <div className="app-shell flex flex-col">
        <header className="bg-primary px-4 pt-6 pb-8 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-foreground/10">
            <Check className="size-8 text-mint" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-primary-foreground">Pelada criada!</h1>
          <p className="mt-1 text-sm text-mint">
            {criada.titulo} · {criada.cidade}
          </p>
          {criada.total > 1 && (
            <p className="mt-1 text-xs text-primary-foreground/70">
              Recorrente: {criada.total} peladas já agendadas, uma por semana.
            </p>
          )}
        </header>
        <div className="flex-1 space-y-4 p-5">
          <div className="rounded-2xl border-2 border-dashed border-mint bg-mint-soft p-4 text-center">
            <p className="text-xs font-medium text-muted-foreground">Link de convite</p>
            <p className="mt-1 text-sm font-bold break-all text-primary">{link}</p>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Link copiado!");
            }}
          >
            <Share2 className="mr-2 size-4" /> Compartilhar link
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/pelada/$id" params={{ id: criada.id }}>
              Abrir a pelada
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Ver no feed</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell flex flex-col pb-24">
      <header className="flex items-center gap-3 bg-primary px-4 py-4">
        <Link to="/" aria-label="Voltar">
          <ArrowLeft className="size-5 text-primary-foreground" />
        </Link>
        <h1 className="text-lg font-extrabold text-primary-foreground">Criar Pelada</h1>
      </header>

      <div className="flex-1 space-y-4 p-5">
        <div className="flex gap-1 rounded-xl bg-secondary p-1">
          {(
            [
              { id: "agendar", rotulo: "Agendar pelada" },
              { id: "agora", rotulo: "Começar agora" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={modo === m.id}
              onClick={() => setModo(m.id)}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-bold transition-colors",
                modo === m.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {m.rotulo}
            </button>
          ))}
        </div>
        {modo === "agora" && (
          <p className="rounded-2xl bg-mint-soft p-3 text-xs text-foreground">
            Já tem a lista do WhatsApp? Dá um nome, cria e cola a lista na próxima tela pra sortear
            os times e abrir o placar. Ninguém precisa ter conta.
          </p>
        )}

        <div>
          <Label htmlFor="titulo">Título</Label>
          <Input
            id="titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Pelada de quinta"
            className="mt-1"
          />
        </div>

        {(turmas.data?.length ?? 0) > 0 && (
          <div>
            <Label htmlFor="turma">Turma</Label>
            <select
              id="turma"
              value={turmaEscolhida}
              onChange={(e) => setTurmaManual(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground"
            >
              {(turmas.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
              <option value="nova">Nova turma{titulo.trim() ? `: ${titulo.trim()}` : ""}</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Gols e vitórias somam no ranking da turma. Use a mesma turma toda semana.
            </p>
          </div>
        )}

        {modo === "agendar" && (
          <>
            <div>
              <Label htmlFor="data">Data</Label>
              {/* no iPhone o campo de data tem largura própria e vazava pra cima do vizinho:
                  linha só dele, sem a aparência nativa que força essa largura */}
              <Input
                id="data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="mt-1 block w-full min-w-0 appearance-none text-left [&::-webkit-date-and-time-value]:text-left"
              />
            </div>

            <div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="horario">Início</Label>
                  <CampoHorario
                    id="horario"
                    rotulo="Início"
                    valor={horario}
                    onMudar={(novo) => {
                      setHorario(novo);
                      if (!horarioFimTocado) setHorarioFim(somarHora(novo, 1));
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="horarioFim">Término</Label>
                  <CampoHorario
                    id="horarioFim"
                    rotulo="Término"
                    valor={horarioFim}
                    onMudar={(novo) => {
                      setHorarioFim(novo);
                      setHorarioFimTocado(true);
                    }}
                    className="mt-1"
                  />
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                O término já vem 1h depois do início. Muda se sua pelada for mais curta ou mais
                longa.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Repeat className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <Label htmlFor="recorrente">Pelada recorrente</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {diaSemana
                        ? `Cria uma pelada nova ${diaSemana}, toda semana`
                        : "Repete automaticamente toda semana, no mesmo dia e horário"}
                    </p>
                  </div>
                </div>
                <Switch id="recorrente" checked={recorrente} onCheckedChange={setRecorrente} />
              </div>
              {recorrente && (
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-sm text-muted-foreground">Por quantas semanas</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Menos semanas"
                      onClick={() => setRepeticoes((r) => Math.max(2, r - 1))}
                      className="flex size-7 items-center justify-center rounded-lg bg-secondary"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-extrabold">{repeticoes}</span>
                    <button
                      type="button"
                      aria-label="Mais semanas"
                      onClick={() => setRepeticoes((r) => Math.min(12, r + 1))}
                      className="flex size-7 items-center justify-center rounded-lg bg-secondary"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="local">Local</Label>
              <Input
                id="local"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Arena Gol Society"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Cidade</Label>
              <div className="mt-1">
                <CidadeCombobox value={cidadeFinal || null} onChange={setCidade} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Usada para mostrar essa pelada no feed de quem está nessa cidade.
              </p>
            </div>

            <div>
              <Label>Quantidade de vagas</Label>
              <div className="mt-1 flex items-center justify-between rounded-xl border border-input bg-card px-3 py-2">
                <button
                  type="button"
                  aria-label="Menos vagas"
                  onClick={() => setVagas((v) => Math.max(2, v - 1))}
                  className="flex size-8 items-center justify-center rounded-lg bg-secondary"
                >
                  <Minus className="size-4" />
                </button>
                <span className="text-lg font-extrabold">{vagas}</span>
                <button
                  type="button"
                  aria-label="Mais vagas"
                  onClick={() => setVagas((v) => Math.min(30, v + 1))}
                  className="flex size-8 items-center justify-center rounded-lg bg-secondary"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            <div>
              <Label>Tipo de pelada</Label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTipo("aberta")}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition-colors",
                    tipo === "aberta" ? "border-mint bg-mint-soft" : "border-border bg-card",
                  )}
                >
                  <Check className="size-5 text-primary" />
                  <p className="mt-2 text-sm font-bold text-foreground">Aberta</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Qualquer jogador entra direto até lotar as vagas.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setTipo("fechada")}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition-colors",
                    tipo === "fechada"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card",
                  )}
                >
                  <Lock
                    className={cn("size-5", tipo === "fechada" ? "text-mint" : "text-primary")}
                  />
                  <p className="mt-2 text-sm font-bold">Fechada</p>
                  <p
                    className={cn(
                      "mt-1 text-[11px]",
                      tipo === "fechada" ? "text-mint" : "text-muted-foreground",
                    )}
                  >
                    Jogador solicita entrada e o organizador aprova manualmente.
                  </p>
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="descricao">Descrição (opcional)</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: R$15 por pessoa via Pix · link do grupo: wa.me/..."
                className="mt-1"
                rows={3}
              />
            </div>
          </>
        )}

        <div>
          <h2 className="mb-3 text-sm font-bold text-foreground">Como vai ser o jogo</h2>
          <ConfigJogoCampos valor={config} onMudar={setConfig} />
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-border bg-card p-4">
        <Button
          className={cn("w-full font-semibold")}
          disabled={!valido || enviando}
          onClick={criar}
        >
          {modo === "agora" ? "Criar e montar os times" : "Criar Pelada"}
        </Button>
      </div>
    </div>
  );
}
