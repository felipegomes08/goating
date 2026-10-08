import { Link } from "@tanstack/react-router";
import { CheckCheck, Clock, Crown, Lock, MapPin, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PeladaFeed = {
  id: string;
  titulo: string;
  data: string;
  horario: string;
  horario_fim: string | null;
  local: string;
  cidade: string;
  quantidade_vagas: number;
  tipo: string;
  status: string;
  organizador_id: string;
  crew_id: string | null;
  /** nome da turma, quando a pelada é de uma */
  turma: string | null;
  /** Quando a pelada foi finalizada — define a janela de 24h de avaliação. */
  finalizada_em: string | null;
  mvp: { nome_exibicao: string } | null;
  confirmados: number;
  organizador: {
    nome_exibicao: string;
    overall: number | string | null;
    tier_reconhecido: string | null;
  } | null;
  souOrganizador: boolean;
  minhaSituacao: "nenhuma" | "pendente" | "aprovado";
  /** true quando eu já avaliei todos os outros jogadores (a avaliação some do "pendente"). */
  jaAvaliei: boolean;
};

export const JANELA_AVALIACAO_MS = 24 * 60 * 60 * 1000;

/** true enquanto a pelada finalizada ainda está dentro das 24h de avaliação. */
export function estaPendenteAvaliacao(pelada: {
  status?: string | undefined;
  finalizada_em?: string | null | undefined;
}) {
  return (
    pelada.status === "finalizada" &&
    !!pelada.finalizada_em &&
    Date.now() - new Date(pelada.finalizada_em).getTime() < JANELA_AVALIACAO_MS
  );
}

/** true quando o usuário já avaliou todos os outros jogadores aprovados da pelada. */
export function avaliouTodos(
  participantes: { user_id: string; status: string }[],
  avaliadosPorMim: Iterable<string>,
  userId: string,
) {
  const feitos = new Set(avaliadosPorMim);
  const outros = participantes.filter((p) => p.status === "aprovado" && p.user_id !== userId);
  return outros.length > 0 && outros.every((p) => feitos.has(p.user_id));
}

const SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** "HOJE", "AMANHÃ" ou o dia da semana; e o dia/mês pro bloco da data. */
function partesDaData(data: string) {
  const dia = new Date(`${data}T12:00:00`);
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const distancia = Math.round((dia.getTime() - hoje.getTime()) / 86_400_000);
  return {
    hoje: distancia === 0,
    rotulo: distancia === 0 ? "HOJE" : distancia === 1 ? "AMANHÃ" : SEMANA[dia.getDay()],
    dia: String(dia.getDate()).padStart(2, "0"),
    mes: MESES[dia.getMonth()],
  };
}

export function MatchCard({ pelada }: { pelada: PeladaFeed }) {
  const finalizada = pelada.status === "finalizada";
  const emAndamento = pelada.status === "em_andamento";
  const pendenteAvaliacao = estaPendenteAvaliacao(pelada);
  const aberta = pelada.tipo === "aberta";
  const lotado = pelada.confirmados >= pelada.quantidade_vagas;
  const proporcao = Math.min(1, pelada.confirmados / pelada.quantidade_vagas);
  const podeAvaliar =
    pendenteAvaliacao && pelada.minhaSituacao === "aprovado" && pelada.confirmados > 1;
  // Dourado só quando tem avaliação minha de fato pendente.
  const avaliacaoPendente = podeAvaliar && !pelada.jaAvaliei;
  const jaAvaliada = podeAvaliar && pelada.jaAvaliei;
  const data = partesDaData(pelada.data);
  const horario = pelada.horario_fim
    ? `${pelada.horario.slice(0, 5)} às ${pelada.horario_fim.slice(0, 5)}`
    : pelada.horario.slice(0, 5);

  // um selo só por card: o que mais importa pra mim naquela pelada
  const selo = avaliacaoPendente
    ? { texto: "AVALIAR", icone: Star, classe: "bg-tier-ouro/15 text-tier-ouro" }
    : jaAvaliada
      ? { texto: "AVALIADA", icone: CheckCheck, classe: "bg-mint-soft text-primary" }
      : emAndamento
        ? { texto: "ROLANDO", icone: null, classe: "bg-destructive/10 text-destructive" }
        : finalizada
          ? null
          : pelada.souOrganizador
            ? { texto: "ORGANIZADOR", icone: null, classe: "bg-primary text-primary-foreground" }
            : pelada.minhaSituacao === "aprovado"
              ? { texto: "VOCÊ VAI", icone: CheckCheck, classe: "bg-mint text-mint-foreground" }
              : pelada.minhaSituacao === "pendente"
                ? { texto: "AGUARDANDO", icone: null, classe: "bg-secondary text-muted-foreground" }
                : lotado
                  ? { texto: "LOTADA", icone: null, classe: "bg-destructive/10 text-destructive" }
                  : aberta
                    ? null
                    : {
                        texto: "FECHADA",
                        icone: Lock,
                        classe: "bg-secondary text-muted-foreground",
                      };

  return (
    <article
      className={cn(
        "overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)]",
        avaliacaoPendente && "ring-2 ring-tier-ouro",
      )}
    >
      <Link
        to="/pelada/$id"
        params={{ id: pelada.id }}
        className="flex gap-3 p-4 active:bg-secondary/50"
      >
        {/* bloco da data: é a primeira coisa que o olho precisa achar */}
        <div
          className={cn(
            "flex w-[60px] shrink-0 flex-col items-center justify-center rounded-2xl py-2",
            finalizada
              ? "bg-secondary text-muted-foreground"
              : data.hoje
                ? "bg-mint text-mint-foreground"
                : "bg-primary text-primary-foreground",
          )}
        >
          <span className="text-[10px] font-extrabold tracking-wide">{data.rotulo}</span>
          <span className="text-2xl leading-none font-black tabular-nums">{data.dia}</span>
          <span className="text-[10px] font-bold tracking-wide opacity-80">{data.mes}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 min-w-0 text-base leading-tight font-extrabold text-foreground">
              {pelada.titulo}
            </h3>
            {selo && (
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide",
                  selo.classe,
                )}
              >
                {selo.icone && <selo.icone className="size-3" />}
                {selo.texto}
              </span>
            )}
          </div>

          <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-foreground tabular-nums">
            <Clock className="size-3.5 text-muted-foreground" />
            {horario}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">
              {pelada.local} · {pelada.cidade}
            </span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3.5 shrink-0" />
            <span className="truncate">
              {pelada.turma ? (
                <span className="font-semibold text-primary">{pelada.turma}</span>
              ) : (
                `por ${pelada.organizador?.nome_exibicao ?? "organizador"}`
              )}
            </span>
          </p>
          {finalizada && pelada.mvp && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Crown className="size-3.5 shrink-0 text-tier-ouro" />
              <span className="truncate">MVP: {pelada.mvp.nome_exibicao}</span>
            </p>
          )}

          {!finalizada && (
            <div className="mt-2.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full", lotado ? "bg-destructive" : "bg-mint")}
                  style={{ width: `${proporcao * 100}%` }}
                />
              </div>
              <span className="shrink-0 text-[11px] font-semibold text-muted-foreground tabular-nums">
                {pelada.confirmados}/{pelada.quantidade_vagas}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* botão só quando existe algo a fazer além de abrir a pelada */}
      {avaliacaoPendente ? (
        <div className="px-4 pb-4">
          <Button
            asChild
            className="w-full bg-tier-ouro font-semibold text-primary hover:bg-tier-ouro/90"
          >
            <Link to="/pelada/$id/avaliar" params={{ id: pelada.id }}>
              <Star className="mr-1.5 size-4" />
              Avaliar jogadores
            </Link>
          </Button>
        </div>
      ) : !finalizada &&
        !emAndamento &&
        pelada.minhaSituacao === "nenhuma" &&
        !pelada.souOrganizador &&
        !lotado ? (
        <div className="px-4 pb-4">
          <Button asChild className="w-full">
            <Link to="/pelada/$id" params={{ id: pelada.id }}>
              {aberta ? "Entrar na pelada" : "Solicitar entrada"}
            </Link>
          </Button>
        </div>
      ) : null}
    </article>
  );
}
