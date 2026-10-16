import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import type { LinhaElenco } from "@/lib/placar/dados";
import { chaveNome } from "@/lib/placar/lista";

/**
 * Quem entrou no jogo depois que ele começou (ou quem faltou marcar num jogo que já acabou).
 * Mostra quem está no elenco do dia e fora do jogo, e deixa buscar qualquer um da turma pelo
 * nome, ou cadastrar alguém novo. Quem não estava no elenco entra nele, no time daquele lado.
 */
export function EntradaDeJogador({
  matchId,
  crewId,
  time,
  elenco,
  ocupados,
  nomeTime,
  onEntrou,
}: {
  matchId: string;
  crewId: string | null;
  /** time do lado em que a pessoa entra */
  time: number;
  elenco: LinhaElenco[];
  /** quem já está no jogo: não aparece na lista */
  ocupados: string[];
  nomeTime: (time: number) => string;
  onEntrou: (linha: LinhaElenco) => void;
}) {
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  const turma = useQuery({
    queryKey: ["membros-da-turma", crewId],
    enabled: !!crewId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crew_members")
        .select("id, nome, user_id, removido_em")
        .eq("crew_id", crewId!);
      if (error) throw error;
      return data;
    },
  });

  const doElenco = elenco.filter((j) => !ocupados.includes(j.memberId));
  const termo = chaveNome(busca);
  const achados = termo
    ? (turma.data ?? [])
        .filter((m) => !ocupados.includes(m.id) && chaveNome(m.nome).includes(termo))
        // quem está na turma vem antes de quem já saiu
        .sort((a, b) => Number(!!a.removido_em) - Number(!!b.removido_em))
        .slice(0, 6)
    : [];
  const existeIgual = (turma.data ?? []).some((m) => chaveNome(m.nome) === termo);

  const linhaNova = (memberId: string, nome: string, userId: string | null): LinhaElenco => ({
    memberId,
    time,
    gols: 0,
    jogos: 0,
    vitorias: 0,
    empates: 0,
    derrotas: 0,
    assistencias: 0,
    defesas: 0,
    amarelos: 0,
    azuis: 0,
    vermelhos: 0,
    nome,
    userId,
  });

  /** Põe no elenco do dia quem ainda não estava, no time daquele lado. */
  async function entrar(membro: { id: string; nome: string; user_id: string | null }) {
    const noElenco = elenco.find((j) => j.memberId === membro.id);
    if (noElenco) {
      onEntrou(noElenco);
      return;
    }
    setSalvando(true);
    const { error } = await supabase
      .from("match_players")
      .upsert(
        { match_id: matchId, member_id: membro.id, time },
        { onConflict: "match_id,member_id" },
      );
    setSalvando(false);
    if (error) {
      toast.error("Não deu pra colocar esse jogador. Confere a internet.");
      return;
    }
    onEntrou(linhaNova(membro.id, membro.nome, membro.user_id));
  }

  async function cadastrar() {
    const nome = busca.replace(/\s+/g, " ").trim();
    if (!nome || !crewId) return;
    setSalvando(true);
    const { data: criado, error } = await supabase
      .from("crew_members")
      .insert({ crew_id: crewId, nome })
      .select("id, nome, user_id")
      .single();
    setSalvando(false);
    if (error) {
      toast.error("Não deu pra cadastrar esse jogador. Confere a internet.");
      return;
    }
    await entrar(criado);
  }

  return (
    <div className="space-y-3">
      {crewId && (
        <div className="space-y-2">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome de quem entrou"
            aria-label="Nome de quem entrou"
            maxLength={40}
          />
          {achados.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {achados.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={salvando}
                  onClick={() => void entrar(m)}
                  className="rounded-xl border-2 border-primary/40 bg-mint-soft px-3 py-2.5 text-left text-sm font-semibold text-foreground"
                >
                  {m.nome}
                  <span className="block text-[10px] font-medium text-muted-foreground">
                    {elenco.some((j) => j.memberId === m.id) ? "No elenco de hoje" : "Da turma"}
                  </span>
                </button>
              ))}
            </div>
          )}
          {termo && !existeIgual && (
            <button
              type="button"
              disabled={salvando}
              onClick={() => void cadastrar()}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-primary px-3 py-2.5 text-left text-sm font-bold text-primary"
            >
              <UserPlus className="size-4 shrink-0" />
              <span className="min-w-0 truncate">Adicionar “{busca.trim()}” como jogador novo</span>
            </button>
          )}
        </div>
      )}

      {!termo &&
        (doElenco.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todo mundo do elenco de hoje já está nesse jogo. Digite o nome de quem entrou.
          </p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Do elenco de hoje</p>
            <div className="grid grid-cols-2 gap-1.5">
              {doElenco.map((j) => (
                <button
                  key={j.memberId}
                  type="button"
                  disabled={salvando}
                  onClick={() => onEntrou(j)}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm font-semibold"
                >
                  {j.nome}
                  {j.time !== null && (
                    <span className="block text-[10px] font-medium text-muted-foreground">
                      {nomeTime(j.time)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
