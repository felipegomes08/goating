import { useState } from "react";
import { MapPin, X } from "lucide-react";
import { FolhaMapa } from "@/components/goating/folha-mapa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { linkDoPonto, linkValido, pontoDoLink } from "@/lib/local";

/** O que o campo guarda é sempre um link; vazio quer dizer "sem localização". */
export const problemaDoLink = (link: string) =>
  link.trim() && !linkValido(link) ? "Cole o link inteiro, começando com https://" : null;

/** Localização da pelada: cola o link do Maps/Waze ou marca o ponto no mapa. */
export function CampoLocalizacao({
  valor,
  onMudar,
  cidade,
}: {
  valor: string;
  onMudar: (link: string) => void;
  cidade: string;
}) {
  const [mapaAberto, setMapaAberto] = useState(false);
  const problema = problemaDoLink(valor);
  const ponto = pontoDoLink(valor);

  return (
    <div>
      <Label htmlFor="localLink">Localização (opcional)</Label>
      <div className="mt-1 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            id="localLink"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={valor}
            onChange={(e) => onMudar(e.target.value)}
            placeholder="Cole o link do Maps ou Waze"
            className={valor ? "pr-9" : undefined}
          />
          {valor && (
            <button
              type="button"
              aria-label="Tirar a localização"
              onClick={() => onMudar("")}
              className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <Button type="button" variant="outline" onClick={() => setMapaAberto(true)}>
          <MapPin className="mr-1.5 size-4" /> {ponto ? "Ajustar" : "Marcar no mapa"}
        </Button>
      </div>
      {problema ? (
        <p className="mt-1 text-xs font-medium text-destructive" role="alert">
          {problema}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          {ponto
            ? "Ponto marcado. Na pelada, tocar no local abre o Maps ou o Waze direto nele."
            : "Com ela, quem tocar no local da pelada já sai com a rota no Maps ou no Waze."}
        </p>
      )}

      {mapaAberto && (
        <FolhaMapa
          inicial={ponto}
          cidade={cidade}
          onEscolher={(novo) => {
            onMudar(linkDoPonto(novo));
            setMapaAberto(false);
          }}
          onFechar={() => setMapaAberto(false)}
        />
      )}
    </div>
  );
}
