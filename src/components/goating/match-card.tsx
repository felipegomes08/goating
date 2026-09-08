import { CalendarDays, Check, Lock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tierDoJogador } from "@/lib/tiers";

export type PeladaFeed = {
  id: string;
  titulo: string;
  data: string;
  horario: string;
  local: string;
  cidade: string;
  quantidade_vagas: number;
  tipo: string;
  confirmados: number;
  organizador: {
    nome_exibicao: string;
    overall: number;
    peladas_jogadas: number;
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

function dataFormatada(data: string, horario: string) {
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
  return `${semana}, ${d.getDate()} ${mes} · ${hh}:${mm}`;
}

export function MatchCard({
  pelada,
  onEntrar,
  carregando,
}: {
  pelada: PeladaFeed;
  onEntrar: (p: PeladaFeed) => void;
  carregando?: boolean;
}) {
  const aberta = pelada.tipo === "aberta";
  const lotado = pelada.confirmados >= pelada.quantidade_vagas;
  const proporcao = Math.min(1, pelada.confirmados / pelada.quantidade_vagas);
  const tier = pelada.organizador
    ? tierDoJogador(Number(pelada.organizador.overall), pelada.organizador.peladas_jogadas)
    : null;

  const barra = lotado ? "bg-destructive" : proporcao > 0.7 ? "bg-mint" : "bg-primary";

  return (
    <article className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-bold text-foreground">{pelada.titulo}</h3>
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
          {dataFormatada(pelada.data, pelada.horario)}
        </p>
        <p className="flex items-center gap-2 px-3 py-2 text-xs text-foreground">
          <MapPin className="size-4 text-muted-foreground" />
          {pelada.local} · {pelada.cidade}
        </p>
      </div>

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

      <div className="mt-4">
        {pelada.minhaSituacao === "aprovado" ? (
          <Button disabled className="w-full bg-mint-soft text-primary" variant="secondary">
            Você está dentro
          </Button>
        ) : pelada.minhaSituacao === "pendente" ? (
          <Button disabled variant="secondary" className="w-full">
            Solicitação enviada
          </Button>
        ) : lotado ? (
          <Button disabled className="w-full">
            Lotado
          </Button>
        ) : aberta ? (
          <Button
            className="w-full bg-mint font-semibold text-mint-foreground hover:bg-mint/90"
            onClick={() => onEntrar(pelada)}
            disabled={carregando}
          >
            Entrar
          </Button>
        ) : (
          <Button className="w-full" onClick={() => onEntrar(pelada)} disabled={carregando}>
            Solicitar entrada
          </Button>
        )}
      </div>
    </article>
  );
}
