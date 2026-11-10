import { useState } from "react";
import { ImageIcon, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { LinhaDaLiga } from "@/hooks/use-ligas";
import { compartilhar } from "@/lib/placar/dados";
import { compartilharTabela } from "@/lib/placar/poster";
import {
  COLUNAS_DA_LIGA,
  ordenarLiga,
  type ColunaDaLiga,
} from "@/components/goating/liga/tabela-da-liga";

/**
 * Botões "Texto" e "Compartilhar tabela" da liga, na ordem que está na tela: dá pra mandar no
 * grupo quem está na frente em cada quesito.
 */
export function CompartilharLiga({
  liga,
  turma,
  periodo,
  linhas,
  ordem,
}: {
  liga: string;
  turma: string;
  /** "1 de nov. a 31 de dez." (periodoDaLiga) */
  periodo: string;
  linhas: LinhaDaLiga[];
  ordem: ColunaDaLiga;
}) {
  const [gerando, setGerando] = useState(false);
  const ordenadas = ordenarLiga(linhas, ordem);
  const coluna = COLUNAS_DA_LIGA.find((c) => c.id === ordem) ?? COLUNAS_DA_LIGA[0]!;

  async function texto() {
    const medalhas = ["🥇", "🥈", "🥉"];
    const msg = [
      `🏆 *${liga}* · ${turma}`,
      `${periodo} · por ${coluna.nome}`,
      "",
      ...ordenadas.slice(0, 15).map((l, i) => {
        const destaque = ordem === "pontos" ? "" : ` · *${l[ordem]} ${coluna.sigla}*`;
        const mvp = l.mvps ? ` · ${l.mvps} MVP` : "";
        return `${medalhas[i] ?? `${i + 1}.`} *${l.nome}* · ${l.pontos} pts${destaque} · ${l.peladas}J ${l.vitorias}V ${l.empates}E · ${l.gols} gols${mvp}`;
      }),
    ].join("\n");
    const resultado = await compartilhar(msg);
    if (resultado === "copiado") toast.success("Tabela copiada. Cola no grupo!");
  }

  async function imagem() {
    setGerando(true);
    try {
      const resultado = await compartilharTabela(
        {
          etiqueta: "LIGA",
          titulo: liga,
          periodo: `${turma} · ${periodo}`,
          colunas: COLUNAS_DA_LIGA.map((c) => c.sigla),
          colunaOrdenada: COLUNAS_DA_LIGA.findIndex((c) => c.id === ordem),
          linhas: ordenadas.map((l) => ({
            nome: l.nome,
            valores: COLUNAS_DA_LIGA.map((c) => String(l[c.id])),
          })),
          legenda:
            "P pontos  ·  J peladas  ·  V vitórias  ·  E empates  ·  G gols  ·  A assist.  ·  MVP",
        },
        "goating-liga.png",
      );
      if (resultado === "baixado") toast.success("Imagem baixada. Manda no grupo!");
    } catch {
      toast.error("Não deu pra gerar a imagem.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" className="flex-1" onClick={() => void texto()}>
        <Share2 className="mr-2 size-4" /> Texto
      </Button>
      <Button className="flex-[1.6]" disabled={gerando} onClick={() => void imagem()}>
        {gerando ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <ImageIcon className="mr-2 size-4" />
        )}
        Compartilhar tabela
      </Button>
    </div>
  );
}
