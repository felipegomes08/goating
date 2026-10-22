import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Cadeado } from "@/components/goating/cadeado";
import { MVPS_MARCANTES } from "@/lib/placar/cartao-mvp";
import { cn } from "@/lib/utils";

/** Quantos MVPs aparecem antes do "Ver todos". */
const MOSTRAR = 5;

/**
 * Galeria de MVPs do perfil (Premium): todas as peladas em que a pessoa foi MVP, da mais nova
 * pra mais antiga, com os MVPs marcantes (5º, 10º, 20º...) em destaque. Quem não é Premium vê
 * só quantos tem e o cadeado.
 */
export function GaleriaDeMvps({
  userId,
  total,
  premium,
}: {
  userId: string;
  total: number;
  premium: boolean;
}) {
  const { data: lista = [] } = useQuery({
    queryKey: ["galeria-mvps", userId],
    enabled: premium && total > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, titulo, data")
        .eq("mvp_id", userId)
        .order("data", { ascending: true });
      if (error) throw error;
      // número de cada MVP na ordem em que aconteceram; a lista mostra do mais novo pro mais antigo
      return data.map((m, i) => ({ ...m, numero: i + 1 })).reverse();
    },
  });

  const [todos, setTodos] = useState(false);

  if (total === 0) return null;
  // os mais recentes aparecem; o resto abre no "Ver todos"
  const visiveis = todos ? lista : lista.slice(0, MOSTRAR);

  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2">
        <Crown className="size-4 fill-tier-ouro text-tier-ouro" />
        <h2 className="flex-1 text-sm font-bold text-foreground">Galeria de MVPs ({total})</h2>
        {!premium && <Cadeado recurso="Galeria de MVPs" />}
      </div>
      {premium ? (
        <ul className="mt-2 divide-y divide-border">
          {visiveis.map((m) => {
            const marcante = MVPS_MARCANTES.includes(m.numero);
            return (
              <li key={m.id}>
                <Link
                  to="/pelada/$id"
                  params={{ id: m.id }}
                  className="flex items-center gap-3 py-2"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-black tabular-nums",
                      marcante
                        ? "bg-gradient-to-br from-[#FFF3B0] via-[#E9B93A] to-[#8A6A12] text-[#3A2A05] shadow-[0_0_12px_#F7D774]"
                        : "bg-tier-ouro/15 text-tier-ouro",
                    )}
                  >
                    {m.numero}º
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {m.titulo}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {new Date(`${m.data}T12:00:00`).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      {marcante && " · MVP marcante"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
          {lista.length > MOSTRAR && (
            <li>
              <button
                type="button"
                onClick={() => setTodos((v) => !v)}
                className="flex w-full items-center justify-center gap-1 pt-2 text-xs font-bold text-primary"
              >
                {todos ? "Mostrar menos" : `Ver todos os ${lista.length} MVPs`}
                <ChevronDown
                  className={cn("size-3.5 transition-transform", todos && "rotate-180")}
                />
              </button>
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          Guarde todos os seus MVPs, com cartas especiais no 5º, 10º e 20º.
        </p>
      )}
    </section>
  );
}
