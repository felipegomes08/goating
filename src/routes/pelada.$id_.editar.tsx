import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Lock, Minus, Plus, Repeat } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useVoltar } from "@/hooks/use-voltar";
import { CampoHorario } from "@/components/goating/campo-horario";
import { CidadeCombobox } from "@/components/goating/cidade-combobox";
import {
  CONFIG_PADRAO,
  ConfigJogoCampos,
  configParaPelada,
  peladaParaConfig,
  type ConfigJogo,
} from "@/components/goating/config-jogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { podeGerirPelada } from "@/lib/placar/dados";

export const Route = createFileRoute("/pelada/$id_/editar")({
  ssr: false,
  head: () => ({ meta: [{ title: "Editar pelada · Goating" }] }),
  component: EditarPelada,
});

const emMinutos = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function EditarPelada() {
  const { id } = useParams({ from: "/pelada/$id_/editar" });
  const { userId, carregando } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const voltar = useVoltar(
    () => void navigate({ to: "/pelada/$id", params: { id }, replace: true }),
  );

  const consulta = useQuery({
    queryKey: ["pelada-editar", id, userId],
    enabled: !!userId,
    // o formulário guarda os campos em estado local; recarregar por trás apagaria o que está sendo digitado
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
      const podeGerir = await podeGerirPelada(pelada, userId!);
      // as próximas da mesma série (recorrente): mesmo organizador, turma, título e horário
      let serie = supabase
        .from("matches")
        .select("id")
        .eq("organizador_id", pelada.organizador_id)
        .eq("titulo", pelada.titulo)
        .eq("horario", pelada.horario)
        .eq("status", "agendada")
        .gt("data", pelada.data);
      serie = pelada.crew_id ? serie.eq("crew_id", pelada.crew_id) : serie.is("crew_id", null);
      const { data: proximas } = await serie;
      return { pelada, podeGerir, proximas: (proximas ?? []).map((p) => p.id) };
    },
  });

  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("19:30");
  const [horarioFim, setHorarioFim] = useState("20:30");
  const [descricao, setDescricao] = useState("");
  const [local, setLocal] = useState("");
  const [cidade, setCidade] = useState("");
  const [vagas, setVagas] = useState(10);
  const [tipo, setTipo] = useState<"aberta" | "fechada">("aberta");
  const [config, setConfig] = useState<ConfigJogo>(CONFIG_PADRAO);
  const [naSerie, setNaSerie] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const dados = consulta.data;
  useEffect(() => {
    if (!dados) return;
    const p = dados.pelada;
    setTitulo(p.titulo);
    setData(p.data);
    setHorario(p.horario.slice(0, 5));
    setHorarioFim((p.horario_fim ?? p.horario).slice(0, 5));
    setDescricao(p.descricao ?? "");
    setLocal(p.local);
    setCidade(p.cidade);
    setVagas(p.quantidade_vagas);
    setTipo(p.tipo === "fechada" ? "fechada" : "aberta");
    setConfig(peladaParaConfig(p));
  }, [dados]);

  if (carregando || consulta.isLoading) {
    return (
      <div className="app-shell space-y-3 p-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const motivo = !dados
    ? "Essa pelada não existe mais."
    : !dados.podeGerir
      ? "Só o organizador ou um administrador da turma edita a pelada."
      : dados.pelada.status !== "agendada"
        ? "Só dá pra editar antes de a pelada começar."
        : null;
  if (!dados || motivo) {
    return (
      <div className="app-shell flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">{motivo}</p>
        <Button asChild>
          <Link to="/pelada/$id" params={{ id }} replace>
            Voltar pra pelada
          </Link>
        </Button>
      </div>
    );
  }

  const { proximas } = dados;
  const duracaoMin = emMinutos(horarioFim) - emMinutos(horario);
  const problemaHorario =
    data && new Date(`${data}T${horario}`).getTime() < Date.now()
      ? "Esse dia e horário já passaram."
      : duracaoMin <= 0
        ? "O término precisa ser depois do início."
        : duracaoMin < 60
          ? "A pelada precisa ter pelo menos 1 hora."
          : null;
  const valido = titulo.trim() && data && local.trim() && cidade.trim() && !problemaHorario;

  async function salvar() {
    if (!valido) return;
    setSalvando(true);
    const campos = {
      titulo: titulo.trim(),
      horario,
      horario_fim: horarioFim,
      descricao: descricao.trim() || null,
      local: local.trim(),
      cidade: cidade.trim(),
      quantidade_vagas: vagas,
      tipo,
      ...configParaPelada(config),
    };
    // o .select() confirma que a linha mudou mesmo: sem permissão o banco não devolve erro, só não altera
    const { data: mudou, error } = await supabase
      .from("matches")
      .update({ ...campos, data })
      .eq("id", id)
      .select("id");
    let falhouNaSerie = false;
    if (!error && mudou.length > 0 && naSerie && proximas.length > 0) {
      // nas outras semanas muda tudo, menos o dia de cada uma
      const { error: erroSerie } = await supabase.from("matches").update(campos).in("id", proximas);
      falhouNaSerie = !!erroSerie;
    }
    setSalvando(false);
    if (error || !mudou || mudou.length === 0) {
      toast.error("Não deu pra salvar a pelada.");
      return;
    }
    if (falhouNaSerie) toast.error("Salvei essa, mas não consegui mudar as próximas.");
    else
      toast.success(
        naSerie && proximas.length > 0
          ? `Pelada atualizada, junto com as próximas ${proximas.length}.`
          : "Pelada atualizada.",
      );
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pelada", id] }),
      queryClient.invalidateQueries({ queryKey: ["feed"] }),
      queryClient.invalidateQueries({ queryKey: ["turma"] }),
      queryClient.invalidateQueries({ queryKey: ["placar", id] }),
    ]);
    voltar();
  }

  return (
    <div className="app-shell flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 bg-primary px-4 py-4">
        <button type="button" aria-label="Voltar" onClick={voltar}>
          <ArrowLeft className="size-5 text-primary-foreground" />
        </button>
        <h1 className="text-lg font-extrabold text-primary-foreground">Editar pelada</h1>
      </header>

      <div className="flex-1 space-y-4 p-5">
        <div>
          <Label htmlFor="titulo">Título</Label>
          <Input
            id="titulo"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="data">Data</Label>
          <Input
            id="data"
            type="date"
            min={new Date().toLocaleDateString("sv-SE")}
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
                onMudar={setHorario}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="horarioFim">Término</Label>
              <CampoHorario
                id="horarioFim"
                rotulo="Término"
                valor={horarioFim}
                onMudar={setHorarioFim}
                className="mt-1"
              />
            </div>
          </div>
          {problemaHorario && (
            <p className="mt-1 text-xs font-medium text-destructive" role="alert">
              {problemaHorario}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="local">Local</Label>
          <Input
            id="local"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label>Cidade</Label>
          <div className="mt-1">
            <CidadeCombobox value={cidade || null} onChange={setCidade} />
          </div>
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
              aria-pressed={tipo === "aberta"}
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
              aria-pressed={tipo === "fechada"}
              onClick={() => setTipo("fechada")}
              className={cn(
                "rounded-2xl border p-3 text-left transition-colors",
                tipo === "fechada"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card",
              )}
            >
              <Lock className={cn("size-5", tipo === "fechada" ? "text-mint" : "text-primary")} />
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
            className="mt-1"
            rows={3}
          />
        </div>

        <div>
          <h2 className="mb-3 text-sm font-bold text-foreground">Como vai ser o jogo</h2>
          <ConfigJogoCampos valor={config} onMudar={setConfig} />
        </div>

        {proximas.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="flex items-start gap-2">
              <Repeat className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <Label htmlFor="naSerie">Mudar também as próximas {proximas.length}</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Essa pelada se repete. Ligado, a mudança vale pras próximas semanas também (cada
                  uma continua no seu dia). Desligado, muda só essa.
                </p>
              </div>
            </div>
            <Switch id="naSerie" checked={naSerie} onCheckedChange={setNaSerie} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 mt-auto border-t border-border bg-card p-4">
        <Button className="w-full font-semibold" disabled={!valido || salvando} onClick={salvar}>
          {salvando ? "Salvando..." : "Salvar mudanças"}
        </Button>
      </div>
    </div>
  );
}
