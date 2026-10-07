import { useEffect, useRef, useState } from "react";
import { Camera, Images, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { compartilharImagem, gerarPoster, type DadosDoPoster } from "@/lib/placar/poster";

/**
 * Folha de compartilhar o pôster da pelada: mostra a imagem pronta e deixa
 * colocar a foto da galera (câmera ou galeria) antes de mandar.
 */
export function FolhaPoster({
  dados,
  nomeDoArquivo,
  onFechar,
}: {
  dados: Omit<DadosDoPoster, "foto">;
  nomeDoArquivo: string;
  onFechar: () => void;
}) {
  // os dados do resumo não mudam com a folha aberta; guardar a primeira versão
  // evita redesenhar o pôster a cada renderização da tela de trás
  const [base] = useState(dados);
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<{ blob: Blob; url: string } | null>(null);
  const [falhou, setFalhou] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  // A imagem é gerada antes do toque em "Compartilhar": o celular só abre a folha de
  // compartilhar logo depois de um toque, e gerar na hora (ainda mais com foto) passaria do tempo.
  useEffect(() => {
    let vivo = true;
    let url: string | null = null;
    setPrevia(null);
    setFalhou(false);
    gerarPoster({ ...base, foto })
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
  }, [base, foto]);

  function escolher(arquivos: FileList | null) {
    const arquivo = arquivos?.[0];
    if (arquivo) setFoto(arquivo);
  }

  async function compartilhar() {
    if (!previa) return;
    const resultado = await compartilharImagem(previa.blob, nomeDoArquivo);
    if (resultado === "baixado") toast.success("Pôster baixado. Manda no grupo!");
    if (resultado !== "cancelado") onFechar();
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
        aria-label="Compartilhar pôster"
        className="max-h-[94dvh] w-full max-w-[480px] space-y-3 overflow-auto rounded-t-3xl bg-card p-4 pb-6"
      >
        <h2 className="text-lg font-extrabold text-foreground">Pôster da pelada</h2>

        <div className="flex justify-center rounded-2xl bg-foreground/[0.06] p-2">
          {previa ? (
            <img
              src={previa.url}
              alt="Prévia do pôster"
              className="max-h-[46dvh] w-auto rounded-xl shadow-[var(--shadow-float)]"
            />
          ) : falhou ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Não deu pra gerar o pôster{foto ? " com essa foto. Tenta outra." : "."}
            </p>
          ) : (
            <Skeleton className="h-[40dvh] w-[60%] rounded-xl" />
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {foto
            ? "Foto colocada. Pode trocar ou tirar."
            : "Opcional: coloque a foto da galera no pôster."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => camera.current?.click()}>
            <Camera className="mr-2 size-4" /> Tirar foto
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => galeria.current?.click()}>
            <Images className="mr-2 size-4" /> Galeria
          </Button>
          {foto && (
            <Button
              variant="outline"
              size="icon"
              aria-label="Tirar a foto do pôster"
              className="size-11 shrink-0"
              onClick={() => setFoto(null)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
        {/* capture abre a câmera direto no celular; no computador vira o seletor de arquivo */}
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            escolher(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galeria}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            escolher(e.target.files);
            e.target.value = "";
          }}
        />

        <Button className="w-full" disabled={!previa} onClick={compartilhar}>
          <Share2 className="mr-2 size-4" /> {previa ? "Compartilhar" : "Gerando…"}
        </Button>
        <Button variant="ghost" className="w-full" onClick={onFechar}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
