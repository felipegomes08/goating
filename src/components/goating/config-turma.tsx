import { useRef, useState } from "react";
import { Camera, ImagePlus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  tirarFotoDaTurma,
  trocarFotoDaTurma,
  urlDaFotoDaTurma,
  type TipoDeFoto,
} from "@/lib/foto-turma";

/** Folha de configurações da turma: capa, escudo, nome e (só o dono) excluir. */
export function ConfigTurma({
  turma,
  souDono,
  onMudou,
  onExcluir,
  onFechar,
}: {
  turma: { id: string; nome: string; escudo_url: string | null; capa_url: string | null };
  souDono: boolean;
  /** algo foi salvo: a tela de trás recarrega a turma */
  onMudou: () => Promise<void> | void;
  onExcluir: () => void;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(turma.nome);
  const [ocupado, setOcupado] = useState<TipoDeFoto | "nome" | null>(null);
  const campoEscudo = useRef<HTMLInputElement>(null);
  const campoCapa = useRef<HTMLInputElement>(null);
  const escudo = urlDaFotoDaTurma(turma.escudo_url);
  const capa = urlDaFotoDaTurma(turma.capa_url);
  const nomeLimpo = nome.replace(/\s+/g, " ").trim();

  async function enviar(tipo: TipoDeFoto, arquivo: File | undefined) {
    if (!arquivo) return;
    setOcupado(tipo);
    try {
      await trocarFotoDaTurma(
        turma.id,
        tipo,
        arquivo,
        tipo === "escudo" ? turma.escudo_url : turma.capa_url,
      );
      await onMudou();
      toast.success(tipo === "escudo" ? "Escudo atualizado!" : "Capa atualizada!");
    } catch {
      toast.error("Não deu pra enviar essa foto. Tenta outra.");
    } finally {
      setOcupado(null);
    }
  }

  async function tirar(tipo: TipoDeFoto, atual: string) {
    setOcupado(tipo);
    try {
      await tirarFotoDaTurma(turma.id, tipo, atual);
      await onMudou();
    } catch {
      toast.error("Não deu pra tirar a foto.");
    } finally {
      setOcupado(null);
    }
  }

  async function salvarNome() {
    setOcupado("nome");
    const { error } = await supabase.from("crews").update({ nome: nomeLimpo }).eq("id", turma.id);
    setOcupado(null);
    if (error) {
      toast.error("Não deu pra mudar o nome.");
      return;
    }
    await onMudou();
    toast.success("Nome da turma atualizado.");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div
        role="dialog"
        aria-label="Configurações da turma"
        className="max-h-[92dvh] w-full max-w-[480px] space-y-4 overflow-auto rounded-t-3xl bg-card p-4 pb-6"
      >
        <h2 className="text-lg font-extrabold text-foreground">Configurações da turma</h2>

        {/* prévia: capa no fundo e escudo redondo por cima, como fica na página da turma */}
        <div>
          <div className="relative">
            <button
              type="button"
              aria-label="Trocar a capa"
              disabled={ocupado !== null}
              onClick={() => campoCapa.current?.click()}
              className="relative block h-32 w-full overflow-hidden rounded-2xl bg-primary"
            >
              {capa && <img src={capa} alt="" className="size-full object-cover" />}
              <span className="absolute right-2 bottom-2 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white">
                <ImagePlus className="size-4" />
                {ocupado === "capa" ? "Enviando..." : capa ? "Trocar capa" : "Colocar capa"}
              </span>
            </button>
            <button
              type="button"
              aria-label="Trocar o escudo"
              disabled={ocupado !== null}
              onClick={() => campoEscudo.current?.click()}
              className="absolute -bottom-8 left-4 flex size-20 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-primary"
            >
              {escudo ? (
                <img src={escudo} alt="" className="size-full object-cover" />
              ) : (
                <Users className="size-8 text-mint" />
              )}
              <span className="absolute inset-x-0 bottom-0 flex justify-center bg-black/55 py-1">
                <Camera className="size-3.5 text-white" />
              </span>
            </button>
          </div>
          <div className="mt-2 flex min-h-8 justify-end gap-3 pl-28">
            {turma.escudo_url && (
              <button
                type="button"
                disabled={ocupado !== null}
                onClick={() => tirar("escudo", turma.escudo_url!)}
                className="text-xs font-semibold text-muted-foreground underline"
              >
                Tirar escudo
              </button>
            )}
            {turma.capa_url && (
              <button
                type="button"
                disabled={ocupado !== null}
                onClick={() => tirar("capa", turma.capa_url!)}
                className="text-xs font-semibold text-muted-foreground underline"
              >
                Tirar capa
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {ocupado === "escudo"
              ? "Enviando o escudo..."
              : "Toque na capa ou no escudo pra escolher a foto. A capa fica boa com a foto da galera; o escudo aparece redondo."}
          </p>
        </div>

        <input
          ref={campoEscudo}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void enviar("escudo", e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <input
          ref={campoCapa}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void enviar("capa", e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <div className="space-y-1.5">
          <Label htmlFor="nomeDaTurma">Nome da turma</Label>
          <div className="flex gap-2">
            <Input
              id="nomeDaTurma"
              value={nome}
              maxLength={40}
              onChange={(e) => setNome(e.target.value)}
            />
            <Button
              disabled={ocupado !== null || !nomeLimpo || nomeLimpo === turma.nome}
              onClick={salvarNome}
            >
              {ocupado === "nome" ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={onFechar}>
          Fechar
        </Button>

        {souDono && (
          <button
            type="button"
            onClick={onExcluir}
            className="mx-auto flex items-center gap-1.5 py-2 text-xs font-semibold text-destructive"
          >
            <Trash2 className="size-3.5" /> Excluir turma
          </button>
        )}
      </div>
    </div>
  );
}
