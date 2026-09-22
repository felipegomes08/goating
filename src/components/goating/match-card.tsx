import { Link } from "@tanstack/react-router";
import { CalendarDays, Check, Crown, Flag, Lock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tierPorNome } from "@/lib/tiers";

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
  /** Opcional: quando ausente, o card assume que a pelada ainda não terminou (uso no feed). */
  status?: string;
  mvp?: { nome_exibicao: string } | null;
  confirmados: number;
  organizador: {
    nome_exibicao: string;
    tier_reconhecido: string | null;
  } | null;
  minhaSituacao: "nenhuma" | "pendente" | "aprovado";
};

function iniciais(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function dataFormatada(data: string, horario: string, horarioFim: string | null) {
  const d = new Date(`${data}T${horario}`);
  const semana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d.getDay()];
  const mes = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ][d.getMonth()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const faixa = horarioFim ? `${hh}:${mm} às ${horarioFim.slice(0, 5)}` : `${hh}:${mm}`;
  return `${semana}, ${d.getDate()} ${mes} · ${faixa}`;
}

export function MatchCard({ pelada }: { pelada: PeladaFeed }) {
  const finalizada = pelada.status === "finalizada";
  const aberta = pelada.tipo === "aberta";
  const lotado = pelada.confirmados >= pelada.quantidade_vagas;
  const proporcao = Math.min(1, pelada.confirmados / pelada.quantidade_vagas);
  const tier = pelada.organizador ? tierPorNome(pelada.organizador.tier_reconhecido) : null;

  const barra = finalizada
    ? "bg-muted-foreground/40"
    : lotado
      ? "bg-destructive"
      : proporcao > 0.7
        ? "bg-mint"
        : "bg-primary";

  return (
    <article
      className={cn(
        "rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]",
        finalizada && "border-l-4 border-destructive/70 opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-bold text-foreground">{pelada.titulo}</h3>
        {finalizada ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-destructive bg-destructive/10 px-2 py-1 text-[10px] font-bold tracking-wide text-destructive">
            <Flag className="size-3" />
            FINALIZADA
          </span>
        ) : (
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
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {iniciais(pelada.organizador?.nome_exibicao ?? "?")}
        </span>
        <span className="text-xs text-muted-foreground">
          por <span className="font-semibold text-foreground">{pelada.organizador?.nome_exibicao}</span>
        </span>
        {tier && (
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", tier.chipClass)}>
            {tier.nome}
          </span>
        )}
      </div>

      <div className="mt-3 divide-y divide-border rounded-xl bg-secondary/60">
        <p className="flex items-center gap-2 px-3 py-2 text-xs text-foreground">
          <CalendarDays className="size-4 text-muted-foreground" />
          {dataFormatada(pelada.data, pelada.horario, pelada.horario_fim)}
        </p>
        <p className="flex items-center gap-2 px-3 py-2 text-xs text-foreground">
          <MapPin className="size-4 text-muted-foreground" />
          {pelada.local} · {pelada.cidade}
        </p>
        {finalizada && pelada.mvp && (
          <p className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-foreground">
            <Crown className="size-4 text-tier-ouro" />
            MVP: {pelada.mvp.nome_exibicao}
          </p>
        )}
      </div>

      {!finalizada && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">
              {pelada.confirmados}/{pelada.quantidade_vagas} confirmados
            </span>
            {lotado && <span className="font-bold text-destructive">LOTADO</span>}
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", barra)} style={{ width: `${proporcao * 100}%` }} />
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {finalizada ? (
          <Button asChild variant="outline" className="flex-1">
            <Link to="/pelada/$id" params={{ id: pelada.id }}>
              Ver detalhes
            </Link>
          </Button>
        ) : (
          <>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/pelada/$id" params={{ id: pelada.id }}>
                Ver detalhes
              </Link>
            </Button>
            {pelada.minhaSituacao === "aprovado" ? (
              <Button disabled className="flex-1 bg-mint-soft text-primary" variant="secondary">
                Você está dentro
              </Button>
            ) : pelada.minhaSituacao === "pendente" ? (
              <Button disabled variant="secondary" className="flex-1">
                Solicitação enviada
              </Button>
            ) : lotado ? (
              <Button disabled className="flex-1">
                Lotado
              </Button>
            ) : aberta ? (
              <Button asChild className="flex-1 bg-mint font-semibold text-mint-foreground hover:bg-mint/90">
                <Link to="/pelada/$id" params={{ id: pelada.id }}>
                  Entrar
                </Link>
              </Button>
            ) : (
              <Button asChild className="flex-1">
                <Link to="/pelada/$id" params={{ id: pelada.id }}>
                  Solicitar entrada
                </Link>
              </Button>
            )}
          </>
        )}
      </div>
    </article>
  );
}
