import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

export type PerfilAchado = {
  id: string;
  nome_exibicao: string;
  handle: string | null;
  cidade: string | null;
  posicao_preferida: string | null;
  overall: number | string | null;
  avaliacoes_recebidas: number;
};

/** Busca quem já tem conta no Goating, por nome ou @, pra adicionar com um toque. */
export function BuscaJogador({
  ignorar,
  rotuloAcao = "Adicionar",
  ocupado,
  onEscolher,
}: {
  /** ids de contas que já estão na lista e não devem aparecer */
  ignorar: string[];
  rotuloAcao?: string;
  ocupado?: boolean;
  onEscolher: (perfil: PerfilAchado) => void;
}) {
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    const espera = setTimeout(() => setBusca(termo.trim().replace(/^@/, "")), 300);
    return () => clearTimeout(espera);
  }, [termo]);

  const achados = useQuery({
    queryKey: ["busca-jogador", busca],
    enabled: busca.length >= 2,
    queryFn: async (): Promise<PerfilAchado[]> => {
      // vírgula, parênteses e % quebrariam o filtro "or" do PostgREST
      const limpo = busca.replace(/[,()%*\\]/g, " ");
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, nome_exibicao, handle, cidade, posicao_preferida, overall, avaliacoes_recebidas",
        )
        .eq("eh_convidado", false)
        .or(`nome_exibicao.ilike.%${limpo}%,handle.ilike.%${limpo}%`)
        .order("nome_exibicao")
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  const lista = (achados.data ?? []).filter((p) => !ignorar.includes(p.id));

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar quem tem conta, por nome ou @"
          className="pl-9"
        />
      </div>
      {busca.length >= 2 && (
        <div className="divide-y divide-border rounded-xl border border-border">
          {achados.isLoading ? (
            <p className="p-3 text-xs text-muted-foreground">Procurando…</p>
          ) : lista.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              Ninguém com esse nome{(achados.data?.length ?? 0) > 0 ? " fora da lista" : ""}.
            </p>
          ) : (
            lista.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={ocupado}
                onClick={() => onEscolher(p)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {p.nome_exibicao}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {[p.handle ? `@${p.handle}` : null, p.cidade].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-mint px-2.5 py-1 text-[11px] font-bold text-mint-foreground">
                  <UserPlus className="size-3.5" /> {rotuloAcao}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
