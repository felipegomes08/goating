import { useState } from "react";
import { Share2 } from "lucide-react";
import type { LinhaDaLiga, Premio } from "@/hooks/use-ligas";
import { FolhaCartao } from "@/components/goating/folha-cartao";
import { Button } from "@/components/ui/button";
import { CATEGORIAS, ORDEM_DAS_CATEGORIAS, periodoDaLiga, type Categoria } from "@/lib/ligas";
import { gerarCartaoDaLiga } from "@/lib/placar/cartao-liga";

/**
 * Fim da liga: o campeão em destaque, os premiados de cada categoria e o cartão pra
 * compartilhar (pódio + prêmios).
 */
export function PremiadosDaLiga({
  liga,
  turma,
  premios,
  tabela,
}: {
  liga: { nome: string; inicio: string; fim: string; encerrada_em: string | null };
  turma: string | null;
  premios: Premio[];
  tabela: LinhaDaLiga[];
}) {
  const [compartilhando, setCompartilhando] = useState(false);
  const de = (c: Categoria) => premios.filter((p) => p.categoria === c);
  const campeoes = de("campeao");
  const primeiroNome = (n: string) => n.split(" ")[0] ?? n;

  return (
    <section className="space-y-3">
      <div className="rounded-3xl border border-tier-ouro/50 bg-gradient-to-b from-tier-ouro/20 to-card p-4 text-center shadow-[var(--shadow-card)]">
        <p className="text-3xl">🏆</p>
        <p className="mt-1 text-[11px] font-extrabold tracking-wide text-amber-700 uppercase">
          {campeoes.length > 1 ? "Campeões" : "Campeão"}
        </p>
        <p className="text-2xl leading-tight font-black text-foreground">
          {campeoes.map((c) => c.nome).join(" e ") || "Ninguém pontuou"}
        </p>
        {campeoes[0] && (
          <p className="text-sm font-semibold text-muted-foreground">{campeoes[0].valor} pontos</p>
        )}
        <Button
          className="mt-3 w-full bg-tier-ouro font-bold text-primary hover:bg-tier-ouro/90"
          onClick={() => setCompartilhando(true)}
        >
          <Share2 className="mr-2 size-4" /> Cartão do campeão
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ORDEM_DAS_CATEGORIAS.filter((c) => c !== "campeao").map((c) => {
          const ganhadores = de(c);
          if (!ganhadores.length) return null;
          const { rotulo, icone: Icone, unidade } = CATEGORIAS[c];
          return (
            <div key={c} className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
              <p className="flex items-center gap-1 text-[10px] font-extrabold tracking-wide text-muted-foreground uppercase">
                <Icone className="size-3.5 text-tier-ouro" /> {rotulo}
              </p>
              <p className="mt-1 truncate text-sm font-extrabold text-foreground">
                {ganhadores.map((g) => primeiroNome(g.nome)).join(", ")}
              </p>
              <p className="text-[11px] text-muted-foreground">{unidade(ganhadores[0]!.valor)}</p>
            </div>
          );
        })}
      </div>

      {compartilhando && (
        <FolhaCartao
          titulo="Cartão do campeão"
          nomeDoArquivo={`goating-liga-${liga.nome.toLowerCase().replace(/\s+/g, "-")}.png`}
          onFechar={() => setCompartilhando(false)}
          gerar={() =>
            gerarCartaoDaLiga({
              liga: liga.nome,
              turma,
              periodo: periodoDaLiga(liga),
              campeoes: campeoes.map((c) => ({ nome: c.nome, pontos: c.valor })),
              podio: tabela
                .filter((l) => l.posicao > 1)
                .slice(0, 2)
                .map((l) => ({ posicao: l.posicao, nome: l.nome, pontos: l.pontos })),
              premios: ORDEM_DAS_CATEGORIAS.filter((c) => c !== "campeao").flatMap((c) => {
                const ganhadores = de(c);
                return ganhadores.length
                  ? [
                      {
                        rotulo: CATEGORIAS[c].rotulo,
                        texto: `${ganhadores.map((g) => primeiroNome(g.nome)).join(", ")} · ${CATEGORIAS[c].unidade(ganhadores[0]!.valor)}`,
                      },
                    ]
                  : [];
              }),
            })
          }
        />
      )}
    </section>
  );
}
