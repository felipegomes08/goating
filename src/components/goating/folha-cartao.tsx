import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { gerarCartao, type DadosDoCartao } from "@/lib/placar/cartao-perfil";
import { compartilharImagem } from "@/lib/placar/poster";

/** Folha de compartilhar o cartão do perfil: mostra a imagem pronta e manda pro grupo. */
export function FolhaCartao({
  dados,
  titulo = "Seu cartão",
  nomeDoArquivo,
  onFechar,
}: {
  dados: DadosDoCartao;
  titulo?: string;
  nomeDoArquivo: string;
  onFechar: () => void;
}) {
  // o perfil não muda com a folha aberta; guardar a primeira versão evita
  // redesenhar o cartão a cada renderização da tela de trás
  const [base] = useState(dados);
  const [previa, setPrevia] = useState<{ blob: Blob; url: string } | null>(null);
  const [falhou, setFalhou] = useState(false);

  // A imagem é gerada antes do toque em "Compartilhar": o celular só abre a folha de
  // compartilhar logo depois de um toque, e gerar na hora passaria do tempo.
  useEffect(() => {
    let vivo = true;
    let url: string | null = null;
    gerarCartao(base)
      .then((blob) => {
        if (!vivo) return;
        url = URL.createObjectURL(blob);
        setPrevia({ blob, url });
      })
      .catch(() => {
        if (vivo) setFalhou(true);
      });
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [base]);

  async function compartilhar() {
    if (!previa) return;
    const resultado = await compartilharImagem(previa.blob, nomeDoArquivo);
    if (resultado === "baixado") toast.success("Cartão baixado. Manda pra galera!");
    if (resultado !== "cancelado") onFechar();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-label="Compartilhar cartão"
        className="max-h-[94dvh] w-full max-w-[480px] space-y-3 overflow-auto rounded-t-3xl bg-card p-4 pb-6"
      >
        <h2 className="text-lg font-extrabold text-foreground">{titulo}</h2>

        <div className="flex justify-center rounded-2xl bg-foreground/[0.06] p-2">
          {previa ? (
            <img
              src={previa.url}
              alt="Prévia do cartão"
              className="max-h-[62dvh] w-auto rounded-xl shadow-[var(--shadow-float)]"
            />
          ) : falhou ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Não deu pra gerar o cartão agora.
            </p>
          ) : (
            <Skeleton className="h-[56dvh] w-[62%] rounded-xl" />
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onFechar}>
            Fechar
          </Button>
          <Button className="flex-1" disabled={!previa} onClick={compartilhar}>
            <Share2 className="mr-2 size-4" /> Compartilhar
          </Button>
        </div>
      </div>
    </div>
  );
}
