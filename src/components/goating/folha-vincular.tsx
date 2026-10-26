import { useState } from "react";
import { Search, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chaveNome } from "@/lib/placar/lista";

type Candidato = { id: string; nome: string; user_id: string | null };

/** Quão parecido o nome do jogador da turma é com o que veio da lista (maior = mais parecido). */
function parecenca(nomeDaLista: string, nomeDaTurma: string) {
  const a = chaveNome(nomeDaLista);
  const b = chaveNome(nomeDaTurma);
  if (b.startsWith(a) || a.startsWith(b)) return 3;
  const primeiroA = a.split(" ")[0] ?? "";
  const primeiroB = b.split(" ")[0] ?? "";
  if (primeiroA === primeiroB) return 2;
  if (b.includes(primeiroA) || a.includes(primeiroB)) return 1;
  return 0;
}

/**
 * Folha pra dizer quem é, na turma, o jogador que veio da lista colada e entrou como novo
 * (apelido diferente, erro de digitação). O novo some e o elenco de hoje passa pro da turma,
 * com o histórico dele.
 */
export function FolhaVincular({
  nome,
  candidatos,
  onEscolher,
  onFechar,
}: {
  nome: string;
  /** jogadores da turma que ainda não estão no elenco de hoje */
  candidatos: Candidato[];
  /** devolve true quando juntou; a folha fecha sozinha */
  onEscolher: (candidato: Candidato) => Promise<boolean>;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [juntando, setJuntando] = useState<string | null>(null);

  const termo = chaveNome(busca);
  const lista = candidatos
    .filter((c) => !termo || chaveNome(c.nome).includes(termo))
    .sort(
      (a, b) => parecenca(nome, b.nome) - parecenca(nome, a.nome) || a.nome.localeCompare(b.nome),
    );

  async function escolher(c: Candidato) {
    setJuntando(c.id);
    const ok = await onEscolher(c);
    setJuntando(null);
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
        aria-label={`Quem é ${nome} na turma`}
        className="flex max-h-[85dvh] w-full max-w-[480px] flex-col gap-3 rounded-t-3xl bg-card p-4 pb-6"
      >
        <div>
          <h2 className="text-lg font-extrabold text-foreground">Quem é “{nome}” na turma?</h2>
          <p className="text-xs text-muted-foreground">
            Escolha o jogador da turma. O “{nome}” que entrou agora some, e o jogo de hoje conta no
            histórico de quem você escolher.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na turma"
            className="pl-9"
          />
        </div>
        <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto rounded-2xl border border-border">
          {lista.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {candidatos.length === 0
                ? "Todo mundo da turma já está no elenco de hoje."
                : "Ninguém com esse nome na turma."}
            </p>
          ) : (
            lista.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={!!juntando}
                onClick={() => void escolher(c)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-secondary disabled:opacity-50"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                  {c.nome}
                </span>
                {c.user_id && (
                  <span className="flex items-center gap-1 rounded-full bg-mint-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                    <UserCheck className="size-3" /> tem conta
                  </span>
                )}
                {juntando === c.id && (
                  <span className="text-xs text-muted-foreground">Juntando...</span>
                )}
              </button>
            ))
          )}
        </div>
        <Button variant="outline" className="w-full" onClick={onFechar}>
          É novo mesmo
        </Button>
      </div>
    </div>
  );
}
