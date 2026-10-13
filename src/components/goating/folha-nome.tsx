import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chaveNome } from "@/lib/placar/lista";

/** Folha pra corrigir o nome de um jogador (lista colada veio com erro, apelido mudou...). */
export function FolhaNome({
  nomeAtual,
  nomesEmUso = [],
  onSalvar,
  onFechar,
}: {
  nomeAtual: string;
  /** nomes dos outros jogadores da turma: dois com o mesmo nome viram confusão no ranking */
  nomesEmUso?: string[];
  /** devolve true quando salvou; a folha fecha sozinha */
  onSalvar: (nome: string) => Promise<boolean>;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(nomeAtual);
  const [salvando, setSalvando] = useState(false);
  const limpo = nome.replace(/\s+/g, " ").trim();
  // "Alvaro" e "álvaro" contam como o mesmo nome
  const repetido = nomesEmUso.find((n) => chaveNome(n) === chaveNome(limpo));
  const pronto = limpo.length > 0 && limpo !== nomeAtual && !repetido && !salvando;

  async function salvar() {
    if (!pronto) return;
    setSalvando(true);
    const ok = await onSalvar(limpo);
    setSalvando(false);
    if (ok) onFechar();
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
        aria-label="Corrigir nome"
        className="w-full max-w-[480px] space-y-3 rounded-t-3xl bg-card p-4 pb-6"
      >
        <h2 className="text-lg font-extrabold text-foreground">Corrigir nome</h2>
        <Input
          autoFocus
          value={nome}
          maxLength={40}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void salvar();
          }}
          aria-label="Nome do jogador"
        />
        {repetido && (
          <p className="text-xs font-medium text-destructive">
            Já existe {repetido} na turma. Se for outra pessoa, diferencie o nome (sobrenome,
            apelido). Se for a mesma, use o botão Juntar na lista de jogadores da turma.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Muda o nome na turma inteira: times, placar e ranking. Os gols e vitórias continuam com o
          jogador.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onFechar}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={!pronto} onClick={salvar}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
