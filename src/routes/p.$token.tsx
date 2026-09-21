import { useState } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, Lock, MapPin, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { traduzirErroAuth } from "@/lib/auth-erros";
import { GoatingLogo } from "@/components/goating/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/p/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Convite para uma pelada · Goating" },
      {
        name: "description",
        content: "Você foi convidado para uma pelada. Veja os detalhes e confirme sua presença.",
      },
      { property: "og:title", content: "Você foi chamado para uma pelada" },
      {
        property: "og:description",
        content: "Confirme sua presença no Goating e evolua sua cartinha de jogador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Convite,
});

type ConviteInfo = {
  match_id: string;
  titulo: string;
  descricao: string | null;
  data: string;
  horario: string;
  horario_fim: string | null;
  local: string;
  cidade: string;
  quantidade_vagas: number;
  tipo: string;
  confirmados: number;
  organizador_nome: string | null;
};

function dataFormatada(data: string, horario: string, horarioFim: string | null) {
  const d = new Date(`${data}T${horario}`);
  const faixa = horarioFim ? `${horario.slice(0, 5)} às ${horarioFim.slice(0, 5)}` : horario.slice(0, 5);
  return (
    d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) + ` · ${faixa}`
  );
}

function Convite() {
  const { token } = useParams({ from: "/p/$token" });
  const { userId, carregando } = useSession();
  const navigate = useNavigate();
  const [mostrarConvidado, setMostrarConvidado] = useState(false);
  const [nomeConvidado, setNomeConvidado] = useState("");
  const [enviandoConvidado, setEnviandoConvidado] = useState(false);

  const consulta = useQuery({
    queryKey: ["convite", token],
    queryFn: async (): Promise<ConviteInfo | null> => {
      const { data, error } = await supabase.rpc("convite_info", { p_token: token }).returns<
        ConviteInfo[]
      >();
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const info = consulta.data;

  // Quem já está logado não precisa da tela de preview: cai direto na pelada,
  // onde o botão de entrar/solicitar já existe.
  if (!carregando && userId && info) {
    navigate({ to: "/pelada/$id", params: { id: info.match_id }, replace: true });
  }

  async function entrarComoConvidado(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeConvidado.trim() || !info) return;
    setEnviandoConvidado(true);
    try {
      const { data: sessao, error: erroAuth } = await supabase.auth.signInAnonymously({
        options: { data: { nome_exibicao: nomeConvidado.trim() } },
      });
      if (erroAuth) throw erroAuth;
      const uid = sessao.user?.id;
      if (!uid) throw new Error("Não deu para entrar como convidado.");

      // Garante o nome mais recente, mesmo se essa pessoa já tinha entrado
      // como convidado antes nesse mesmo navegador.
      await supabase.from("profiles").update({ nome_exibicao: nomeConvidado.trim() }).eq("id", uid);

      const { error: erroParticipante } = await supabase.from("match_participants").insert({
        match_id: info.match_id,
        user_id: uid,
        status: info.tipo === "aberta" ? "aprovado" : "pendente",
      });
      if (erroParticipante && !/duplicate key|unique/i.test(erroParticipante.message)) {
        throw erroParticipante;
      }

      toast.success(
        info.tipo === "aberta" ? "Presença confirmada!" : "Solicitação enviada ao organizador.",
      );
      navigate({ to: "/pelada/$id", params: { id: info.match_id }, replace: true });
    } catch (err) {
      toast.error(traduzirErroAuth(err));
    } finally {
      setEnviandoConvidado(false);
    }
  }

  if (consulta.isLoading || carregando) {
    return (
      <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <GoatingLogo withWordmark />
        <Skeleton className="h-64 w-full max-w-xs rounded-2xl" />
      </div>
    );
  }

  if (consulta.isError || !info) {
    return (
      <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <GoatingLogo withWordmark />
        <p className="text-sm text-muted-foreground">Esse link de convite não é mais válido.</p>
        <Button asChild>
          <Link to="/">Ver peladas no feed</Link>
        </Button>
      </div>
    );
  }

  if (userId) {
    // Redirecionando (efeito acima já disparou). Evita piscar a tela de convite.
    return (
      <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <GoatingLogo withWordmark />
        <Skeleton className="h-24 w-full max-w-xs rounded-2xl" />
      </div>
    );
  }

  const aberta = info.tipo === "aberta";
  const lotado = info.confirmados >= info.quantidade_vagas;

  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-5 p-6">
      <GoatingLogo withWordmark />

      <div className="w-full max-w-xs rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-lg font-extrabold text-foreground">{info.titulo}</h1>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold tracking-wide",
              aberta
                ? "border-mint bg-mint-soft text-primary"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            {aberta ? <Check className="size-3" /> : <Lock className="size-3" />}
            {aberta ? "ABERTA" : "FECHADA"}
          </span>
        </div>

        {info.organizador_nome && (
          <p className="mt-1 text-xs text-muted-foreground">
            por <span className="font-semibold text-foreground">{info.organizador_nome}</span>
          </p>
        )}

        <div className="mt-3 divide-y divide-border rounded-xl bg-secondary/60">
          <p className="flex items-center gap-2 px-3 py-2 text-xs text-foreground capitalize">
            <CalendarDays className="size-4 text-muted-foreground" />
            {dataFormatada(info.data, info.horario, info.horario_fim)}
          </p>
          <p className="flex items-center gap-2 px-3 py-2 text-xs text-foreground">
            <MapPin className="size-4 text-muted-foreground" />
            {info.local} · {info.cidade}
          </p>
          <p className="flex items-center gap-2 px-3 py-2 text-xs text-foreground">
            <UserRound className="size-4 text-muted-foreground" />
            {info.confirmados}/{info.quantidade_vagas} confirmados
            {lotado && <span className="ml-1 font-bold text-destructive">· LOTADO</span>}
          </p>
        </div>

        {info.descricao && (
          <p className="mt-3 rounded-xl bg-secondary/60 p-3 text-xs text-foreground">{info.descricao}</p>
        )}
      </div>

      <div className="w-full max-w-xs space-y-2">
        {!mostrarConvidado ? (
          <>
            <Button asChild className="w-full bg-mint font-semibold text-mint-foreground hover:bg-mint/90">
              <Link to="/auth" search={{ convite: token }}>
                Entrar
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth" search={{ convite: token, modo: "criar" }}>
                Criar conta
              </Link>
            </Button>
            <button
              type="button"
              onClick={() => setMostrarConvidado(true)}
              className="w-full pt-1 text-center text-xs font-semibold text-muted-foreground underline underline-offset-2"
            >
              Não quero criar conta, só confirmar presença
            </button>
          </>
        ) : (
          <form
            onSubmit={entrarComoConvidado}
            className="space-y-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]"
          >
            <div>
              <Label htmlFor="nome-convidado">Seu nome</Label>
              <Input
                id="nome-convidado"
                value={nomeConvidado}
                onChange={(e) => setNomeConvidado(e.target.value)}
                placeholder="Como a galera te chama"
                required
                autoFocus
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              disabled={enviandoConvidado || !nomeConvidado.trim()}
              className="w-full bg-mint font-semibold text-mint-foreground hover:bg-mint/90"
            >
              {aberta ? "Confirmar presença" : "Solicitar entrada"}
            </Button>
            <button
              type="button"
              onClick={() => setMostrarConvidado(false)}
              className="w-full text-center text-xs font-semibold text-muted-foreground"
            >
              Prefiro criar conta
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
