import { useState } from "react";
import { ImageIcon, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  COLUNAS_GOLEIRO,
  type ColunaGoleiro,
  type LinhaTabelaGoleiro,
} from "@/components/goating/tabela-ranking";
import {
  compartilharImagemDosGoleiros,
  compartilharTextoDosGoleiros,
} from "@/lib/placar/goleiros-compartilhar";

/** "Texto" e "Compartilhar tabela" dos goleiros da liga, na ordem que está na tela. */
export function CompartilharGoleiros({
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
  /** já na ordem da tabela */
  linhas: LinhaTabelaGoleiro[];
  ordem: ColunaGoleiro;
}) {
  const [gerando, setGerando] = useState(false);
  const coluna = COLUNAS_GOLEIRO.find((c) => c.id === ordem);

  async function texto() {
    const resultado = await compartilharTextoDosGoleiros(
      `${liga} · ${turma}`,
      `Goleiros · ${periodo} · por ${coluna?.nome ?? "média"}`,
      linhas,
    );
    if (resultado === "copiado") toast.success("Goleiros copiados. Cola no grupo!");
  }

  async function imagem() {
    setGerando(true);
    try {
      const resultado = await compartilharImagemDosGoleiros({
        etiqueta: "GOLEIROS DA LIGA",
        titulo: liga,
        periodo: `${turma} · ${periodo}`,
        ordem,
        linhas,
      });
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
