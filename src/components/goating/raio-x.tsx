import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Lock, TrendingDown, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { FolhaPremium } from "@/components/goating/cadeado";
import { atributosDe } from "@/lib/atributos";
import { cn } from "@/lib/utils";

type Medias = Record<string, number | null>;
type RaioX = {
  total: number;
  recentes: number;
  ultimos30: Medias;
  antes: Medias;
  peladas: { id: string; titulo: string; data: string; nota: number; avaliacoes: number }[];
};

const nota = (n: number) => n.toFixed(1).replace(".", ",");
const diaCurto = (data: string) =>
  new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * Raio-X das avaliações (Premium): a média de cada habilidade nos últimos 30 dias contra antes,
 * a nota pelada a pelada e os gols e assistências por mês. Quem não é Premium vê a prévia
 * borrada com o convite. Nunca mostra quem deu cada nota.
 */
export function RaioXDoJogador({
  userId,
  posicao,
  premium,
}: {
  userId: string;
  posicao: string | null;
  premium: boolean;
}) {
  const [convite, setConvite] = useState(false);

  const raio = useQuery({
    queryKey: ["raio-x", userId],
    enabled: premium,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("raio_x_do_jogador");
      if (error) throw error;
      return data as unknown as RaioX;
    },
  });

  const porMes = useQuery({
    queryKey: ["gols-por-mes", userId],
    enabled: premium,
    queryFn: async () => {
      const { data: cadastros, error } = await supabase
        .from("crew_members")
        .select("id")
        .eq("user_id", userId);
      if (error) throw error;
      if (!cadastros.length) return [];
      const { data: linhas, error: erroLinhas } = await supabase
        .from("match_players")
        .select("gols, assistencias, matches(data)")
        .in(
          "member_id",
          cadastros.map((c) => c.id),
        );
      if (erroLinhas) throw erroLinhas;
      const meses = new Map<string, { gols: number; assistencias: number }>();
      for (const l of linhas) {
        const data = l.matches?.data;
        if (!data) continue;
        const mes = data.slice(0, 7);
        const atual = meses.get(mes) ?? { gols: 0, assistencias: 0 };
        meses.set(mes, {
          gols: atual.gols + l.gols,
          assistencias: atual.assistencias + l.assistencias,
        });
      }
      return [...meses.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([mes, v]) => ({
          mes: new Date(`${mes}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }),
          ...v,
        }));
    },
  });

  if (!premium) {
    return (
      <section className="relative overflow-hidden rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Activity className="size-4 text-primary" /> Raio-X
        </h2>
        <div aria-hidden className="pointer-events-none mt-3 space-y-2 blur-[5px] select-none">
          {[78, 64, 85, 70].map((v, i) => (
            <div key={i} className="h-3 rounded-full bg-primary/20">
              <div className="h-3 rounded-full bg-primary" style={{ width: `${v}%` }} />
            </div>
          ))}
          <div className="h-20 rounded-xl bg-primary/10" />
        </div>
        <button
          type="button"
          onClick={() => setConvite(true)}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center"
        >
          <Lock className="size-5 text-tier-ouro" />
          <span className="text-sm font-extrabold text-foreground">Raio-X das avaliações</span>
          <span className="px-6 text-xs text-muted-foreground">
            Sua média em cada habilidade, onde melhorou e sua nota pelada a pelada
          </span>
        </button>
        {convite && <FolhaPremium recurso="Raio-X" onFechar={() => setConvite(false)} />}
      </section>
    );
  }

  const dados = raio.data;
  const habilidades = atributosDe(posicao).map((a) => {
    const coluna = a.chave;
    const recente = dados?.ultimos30[coluna] ?? null;
    const antes = dados?.antes[coluna] ?? null;
    return { ...a, recente, antes };
  });
  const comNota = habilidades.filter((h) => h.recente != null);
  const melhor = [...comNota].sort((a, b) => (b.recente ?? 0) - (a.recente ?? 0))[0];
  const pior = [...comNota].sort((a, b) => (a.recente ?? 0) - (b.recente ?? 0))[0];

  return (
    <section className="space-y-4 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Activity className="size-4 text-primary" /> Raio-X
        </h2>
        {dados && (
          <p className="text-xs text-muted-foreground">
            {dados.total} avaliações recebidas · {dados.recentes} nos últimos 30 dias
          </p>
        )}
      </div>

      {melhor && pior && melhor.chave !== pior.chave && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-mint-soft p-3">
            <p className="text-[10px] font-bold tracking-wide text-primary uppercase">Seu forte</p>
            <p className="text-sm font-extrabold text-foreground">{melhor.nome}</p>
            <p className="text-xs text-muted-foreground">{nota(melhor.recente!)} de média</p>
          </div>
          <div className="rounded-xl bg-secondary p-3">
            <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
              Dá pra subir
            </p>
            <p className="text-sm font-extrabold text-foreground">{pior.nome}</p>
            <p className="text-xs text-muted-foreground">{nota(pior.recente!)} de média</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
          Últimos 30 dias
        </p>
        {habilidades.map((h) => {
          const diferenca = h.recente != null && h.antes != null ? h.recente - h.antes : null;
          return (
            <div key={h.chave} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-xs font-semibold text-foreground">
                {h.nome}
              </span>
              <span className="h-2.5 flex-1 rounded-full bg-secondary">
                <span
                  className="block h-2.5 rounded-full bg-primary"
                  style={{ width: `${((h.recente ?? 0) / 10) * 100}%` }}
                />
              </span>
              <span className="w-8 text-right text-xs font-extrabold tabular-nums">
                {h.recente != null ? nota(h.recente) : "—"}
              </span>
              <span
                className={cn(
                  "flex w-10 items-center justify-end gap-0.5 text-[10px] font-bold tabular-nums",
                  diferenca == null
                    ? "text-muted-foreground"
                    : diferenca >= 0
                      ? "text-emerald-600"
                      : "text-destructive",
                )}
              >
                {diferenca == null ? (
                  ""
                ) : diferenca >= 0 ? (
                  <>
                    <TrendingUp className="size-3" />
                    {nota(diferenca)}
                  </>
                ) : (
                  <>
                    <TrendingDown className="size-3" />
                    {nota(-diferenca)}
                  </>
                )}
              </span>
            </div>
          );
        })}
        <p className="text-[10px] text-muted-foreground">
          As setas comparam com a sua média de antes dos últimos 30 dias.
        </p>
      </div>

      {(dados?.peladas.length ?? 0) > 1 && (
        <div>
          <p className="mb-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Nota pelada a pelada
          </p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dados!.peladas.map((p) => ({ dia: diaCurto(p.data), nota: Number(p.nota) }))}
                margin={{ top: 8, right: 8, bottom: 0, left: -24 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => nota(v)} />
                <Line
                  type="monotone"
                  dataKey="nota"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(porMes.data?.length ?? 0) > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Gols e assistências por mês
          </p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={porMes.data ?? []}
                margin={{ top: 8, right: 8, bottom: 0, left: -24 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="gols" name="Gols" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar
                  dataKey="assistencias"
                  name="Assistências"
                  fill="var(--mint)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
