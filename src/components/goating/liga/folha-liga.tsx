import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Liga } from "@/hooks/use-ligas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ITENS_DE_PONTOS, PONTOS_PADRAO, daquiMeses, type Pontos } from "@/lib/ligas";
import { cn } from "@/lib/utils";

const hoje = () => new Date().toLocaleDateString("sv-SE");

/**
 * Criar ou editar a liga da turma: nome, descrição, período (atalhos de 1, 2 e 3 meses) e quanto
 * vale cada coisa na tabela. Na edição, o início fica como está (só o fim muda).
 */
export function FolhaLiga({
  crewId,
  liga,
  onFechar,
  onSalvou,
}: {
  crewId: string;
  /** liga existente = editar */
  liga?: Liga | undefined;
  onFechar: () => void;
  onSalvou?: ((id: string) => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(liga?.nome ?? "");
  const [descricao, setDescricao] = useState(liga?.descricao ?? "");
  const [inicio, setInicio] = useState(liga?.inicio ?? hoje());
  const [fim, setFim] = useState(liga?.fim ?? daquiMeses(2));
  const [pontos, setPontos] = useState<Pontos>(
    liga
      ? {
          pts_vitoria: liga.pts_vitoria,
          pts_empate: liga.pts_empate,
          pts_presenca: liga.pts_presenca,
          pts_gol: liga.pts_gol,
          pts_mvp: liga.pts_mvp,
        }
      : PONTOS_PADRAO,
  );
  const [salvando, setSalvando] = useState(false);

  const nomeLimpo = nome.replace(/\s+/g, " ").trim();
  const exemplo = 2 * pontos.pts_vitoria + pontos.pts_presenca + 2 * pontos.pts_gol;

  async function salvar() {
    if (!nomeLimpo || fim < inicio) return;
    setSalvando(true);
    const { data, error } = liga
      ? await supabase
          .rpc("editar_liga", {
            p_liga_id: liga.id,
            p_nome: nomeLimpo,
            p_descricao: descricao.trim() || null,
            p_fim: fim,
            p_pts_vitoria: pontos.pts_vitoria,
            p_pts_empate: pontos.pts_empate,
            p_pts_presenca: pontos.pts_presenca,
            p_pts_gol: pontos.pts_gol,
            p_pts_mvp: pontos.pts_mvp,
          })
          .then((r) => ({ ...r, data: liga.id }))
      : await supabase.rpc("criar_liga", {
          p_crew_id: crewId,
          p_nome: nomeLimpo,
          p_descricao: descricao.trim() || null,
          p_inicio: inicio,
          p_fim: fim,
          p_pts_vitoria: pontos.pts_vitoria,
          p_pts_empate: pontos.pts_empate,
          p_pts_presenca: pontos.pts_presenca,
          p_pts_gol: pontos.pts_gol,
          p_pts_mvp: pontos.pts_mvp,
        });
    setSalvando(false);
    if (error) {
      toast.error(/[áéíóúãõç]/i.test(error.message) ? error.message : "Não deu pra salvar a liga.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["ligas-da-turma", crewId] });
    if (liga) {
      await queryClient.invalidateQueries({ queryKey: ["liga", liga.id] });
      await queryClient.invalidateQueries({ queryKey: ["tabela-da-liga", liga.id] });
    }
    toast.success(liga ? "Liga atualizada." : "Liga criada! Bora pra disputa. 🏆");
    onSalvou?.(String(data));
    onFechar();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-label={liga ? "Editar liga" : "Criar liga"}
        className="max-h-[92dvh] w-full max-w-[480px] space-y-4 overflow-y-auto rounded-t-3xl bg-background p-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-foreground">
            <Trophy className="size-5 text-tier-ouro" /> {liga ? "Editar liga" : "Criar liga"}
          </h2>
          <button type="button" aria-label="Fechar" onClick={onFechar} className="p-1">
            <X className="size-5 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nomeDaLiga">Nome</Label>
          <Input
            id="nomeDaLiga"
            value={nome}
            maxLength={60}
            placeholder="Ex.: Liga de Verão"
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="descricaoDaLiga">
            Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="descricaoDaLiga"
            value={descricao}
            maxLength={500}
            rows={2}
            placeholder="Premiação, regras combinadas, o que vale..."
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Período</Label>
          {!liga && (
            <div className="flex gap-2">
              {[1, 2, 3].map((m) => {
                const alvo = daquiMeses(m, inicio);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFim(alvo)}
                    className={cn(
                      "flex-1 rounded-full py-1.5 text-xs font-bold",
                      fim === alvo
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {m} {m === 1 ? "mês" : "meses"}
                  </button>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              Começa
              <Input
                type="date"
                value={inicio}
                disabled={!!liga}
                onChange={(e) => setInicio(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Termina
              <Input
                type="date"
                value={fim}
                min={inicio}
                onChange={(e) => setFim(e.target.value)}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Contam as peladas da turma com placar nesse período.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Quanto vale cada coisa</Label>
          <div className="divide-y divide-border rounded-2xl bg-card shadow-sm">
            {ITENS_DE_PONTOS.map((item) => (
              <div key={item.chave} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 text-sm text-foreground">{item.rotulo}</span>
                <button
                  type="button"
                  aria-label={`Menos pontos: ${item.rotulo}`}
                  disabled={pontos[item.chave] <= 0}
                  onClick={() => setPontos((p) => ({ ...p, [item.chave]: p[item.chave] - 1 }))}
                  className="flex size-8 items-center justify-center rounded-lg bg-secondary disabled:opacity-40"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-6 text-center text-base font-black tabular-nums">
                  {pontos[item.chave]}
                </span>
                <button
                  type="button"
                  aria-label={`Mais pontos: ${item.rotulo}`}
                  disabled={pontos[item.chave] >= 10}
                  onClick={() => setPontos((p) => ({ ...p, [item.chave]: p[item.chave] + 1 }))}
                  className="flex size-8 items-center justify-center rounded-lg bg-secondary disabled:opacity-40"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Exemplo: foi à pelada, ganhou 2 jogos e fez 2 gols = <b>{exemplo} pontos</b>.
          </p>
        </div>

        <Button
          className="w-full"
          disabled={salvando || !nomeLimpo || fim < inicio}
          onClick={() => void salvar()}
        >
          {salvando ? "Salvando..." : liga ? "Salvar" : "Criar liga"}
        </Button>
      </div>
    </div>
  );
}
