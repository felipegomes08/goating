import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, EyeOff, Lock, UserRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePerfil } from "@/hooks/use-session";
import { useAvatarUrl } from "@/hooks/use-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { nomeDaNota } from "@/lib/atributos";
import { ehPremium } from "@/lib/premium";
import { cn } from "@/lib/utils";

const nota = (n: number) => Number(n).toFixed(1).replace(".", ",");

/** Nomes de mentira, só pra ter o formato de um nome embaixo do borrado (nada real sai do banco). */
const NOMES_BORRADOS = ["Fulano Tal", "Ciclano", "Beltrano Silva", "Zé Ninguém", "Mané"];

/**
 * Depois que o MVP fecha: as notas de todos os avaliados da pelada e, no topo, "Quem te
 * avaliou". Quem é Premium vê quem deu cada nota (só nas avaliações feitas depois do aviso na
 * tela de avaliar); sem Premium, as notas aparecem com o nome borrado e o convite pra assinar.
 */
export function FolhaAvaliacoesDaPelada({
  matchId,
  mvpId,
  onFechar,
}: {
  matchId: string;
  mvpId: string | null;
  onFechar: () => void;
}) {
  const { userId } = useSession();
  const { data: perfil } = usePerfil(userId);
  const premium = !!perfil && ehPremium(perfil);

  const todos = useQuery({
    queryKey: ["avaliacoes-da-pelada", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("avaliacoes_da_pelada", { p_match_id: matchId });
      if (error) throw error;
      return data;
    },
  });
  const minhas = useQuery({
    queryKey: ["quem-me-avaliou", matchId, userId, premium],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("quem_me_avaliou", { p_match_id: matchId });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-label="Avaliações da pelada"
        className="flex max-h-[90dvh] w-full max-w-[480px] flex-col rounded-t-3xl bg-background"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-lg font-extrabold text-foreground">Avaliações da pelada</h2>
          <button type="button" aria-label="Fechar" onClick={onFechar} className="p-1">
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6">
          {minhas.data && minhas.data.length > 0 && (
            <QuemTeAvaliou avaliacoes={minhas.data} premium={premium} onFechar={onFechar} />
          )}

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-foreground">Todos os avaliados</h3>
            {todos.isLoading ? (
              <Skeleton className="h-48 w-full rounded-2xl" />
            ) : todos.isError ? (
              <p className="text-sm text-muted-foreground">Não deu pra carregar as avaliações.</p>
            ) : (
              <div className="divide-y divide-border rounded-2xl bg-card shadow-[var(--shadow-card)]">
                {(todos.data ?? []).map((j, i) => (
                  <LinhaDoAvaliado
                    key={j.user_id}
                    posicao={i + 1}
                    id={j.user_id}
                    nome={j.nome_exibicao}
                    foto={j.foto_url}
                    nota={j.nota}
                    avaliacoes={j.avaliacoes}
                    mvp={j.user_id === mvpId}
                    eu={j.user_id === userId}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

type Recebida = {
  nota_geral: number;
  notas: unknown;
  identificavel: boolean;
  avaliador_id: string | null;
  nome: string | null;
  foto_url: string | null;
};

function QuemTeAvaliou({
  avaliacoes,
  premium,
  onFechar,
}: {
  avaliacoes: Recebida[];
  premium: boolean;
  onFechar: () => void;
}) {
  const navigate = useNavigate();
  const media = avaliacoes.reduce((s, a) => s + Number(a.nota_geral), 0) / avaliacoes.length;
  const menor = Math.min(...avaliacoes.map((a) => Number(a.nota_geral)));

  function assinar() {
    onFechar();
    void navigate({ to: "/premium", search: { recurso: "Ver quem te avaliou" } });
  }

  return (
    <section className="space-y-3 rounded-3xl border border-tier-ouro/50 bg-gradient-to-b from-tier-ouro/15 to-card p-4">
      <div>
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-tier-ouro uppercase">
          <Crown className="size-3.5" /> Quem te avaliou
        </p>
        <p className="mt-0.5 text-base font-extrabold text-foreground">
          {avaliacoes.length}{" "}
          {avaliacoes.length === 1 ? "pessoa te avaliou" : "pessoas te avaliaram"}
          <span className="font-semibold text-muted-foreground"> · sua nota {nota(media)}</span>
        </p>
      </div>

      <div className="space-y-2">
        {avaliacoes.map((a, i) => (
          <CartaoDaAvaliacao
            key={i}
            avaliacao={a}
            premium={premium}
            indice={i}
            onAbrir={onFechar}
          />
        ))}
      </div>

      {!premium && (
        <Button
          className="w-full bg-tier-ouro font-bold text-primary hover:bg-tier-ouro/90"
          onClick={assinar}
        >
          <Lock className="mr-2 size-4" /> Descubra quem te deu {nota(menor)}
        </Button>
      )}
    </section>
  );
}

function CartaoDaAvaliacao({
  avaliacao,
  premium,
  indice,
  onAbrir,
}: {
  avaliacao: Recebida;
  premium: boolean;
  indice: number;
  onAbrir: () => void;
}) {
  const foto = useAvatarUrl(avaliacao.foto_url);
  const notas = Object.entries((avaliacao.notas ?? {}) as Record<string, number>)
    .map(([chave, valor]) => ({ nome: nomeDaNota(chave), valor: Number(valor) }))
    .filter((n): n is { nome: string; valor: number } => !!n.nome);
  const identificado = premium && !!avaliacao.avaliador_id;

  const quem = identificado ? (
    <Link
      to="/jogador/$id"
      params={{ id: avaliacao.avaliador_id! }}
      onClick={onAbrir}
      className="flex min-w-0 items-center gap-2"
    >
      {foto ? (
        <img src={foto} alt="" className="size-9 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mint-soft">
          <UserRound className="size-4 text-primary" />
        </span>
      )}
      <span className="truncate text-sm font-bold text-foreground">{avaliacao.nome}</span>
    </Link>
  ) : premium ? (
    // Premium, mas a avaliação é de antes do aviso: continua anônima
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <EyeOff className="size-4 text-muted-foreground" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-muted-foreground">
          Avaliação anônima
        </span>
        <span className="block text-[10px] text-muted-foreground">
          feita antes de dar pra ver quem avaliou
        </span>
      </span>
    </div>
  ) : (
    <div className="flex min-w-0 items-center gap-2" aria-label="Nome escondido: Premium">
      <span
        aria-hidden
        className="size-9 shrink-0 rounded-full bg-gradient-to-br from-primary/60 to-tier-ouro/60 blur-[3px]"
      />
      <span
        aria-hidden
        className="truncate text-sm font-bold text-foreground blur-[5px] select-none"
      >
        {NOMES_BORRADOS[indice % NOMES_BORRADOS.length]}
      </span>
      <Lock className="size-3.5 shrink-0 text-tier-ouro" />
    </div>
  );

  return (
    <div className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">{quem}</div>
        <span
          className={cn(
            "shrink-0 text-2xl font-black tabular-nums",
            Number(avaliacao.nota_geral) >= 8 ? "text-primary" : "text-foreground",
          )}
        >
          {nota(avaliacao.nota_geral)}
        </span>
      </div>
      {notas.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {notas.map((n) => (
            <span
              key={n.nome}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
            >
              {n.nome} <span className="font-extrabold text-foreground">{nota(n.valor)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LinhaDoAvaliado({
  posicao,
  id,
  nome,
  foto,
  nota: media,
  avaliacoes,
  mvp,
  eu,
}: {
  posicao: number;
  id: string;
  nome: string;
  foto: string | null;
  nota: number;
  avaliacoes: number;
  mvp: boolean;
  eu: boolean;
}) {
  const url = useAvatarUrl(foto);
  return (
    <Link
      to="/jogador/$id"
      params={{ id }}
      className={cn("flex items-center gap-3 px-3 py-2.5", eu && "bg-mint-soft/60")}
    >
      <span className="w-5 shrink-0 text-right text-xs font-bold text-muted-foreground tabular-nums">
        {posicao}
      </span>
      {url ? (
        <img src={url} alt="" className="size-9 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mint-soft">
          <UserRound className="size-4 text-primary" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 truncate text-sm font-bold text-foreground">
          {nome}
          {mvp && <Crown className="size-3.5 shrink-0 text-tier-ouro" />}
        </span>
        <span className="block text-[11px] text-muted-foreground">
          {avaliacoes} {avaliacoes === 1 ? "avaliação" : "avaliações"}
        </span>
      </span>
      <span className="text-lg font-black text-foreground tabular-nums">{nota(media)}</span>
    </Link>
  );
}
