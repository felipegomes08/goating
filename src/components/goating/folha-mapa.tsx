import { useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Ponto } from "@/lib/local";

// O mapa é o Leaflet com as imagens do OpenStreetMap: os dois são gratuitos e não pedem chave.
// A biblioteca só é baixada quando alguém abre essa folha.
const LEAFLET = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4";

/* eslint-disable @typescript-eslint/no-explicit-any */
let carregando: Promise<any> | null = null;

function carregarLeaflet(): Promise<any> {
  const pronto = (window as any).L;
  if (pronto) return Promise.resolve(pronto);
  carregando ??= new Promise((resolve, reject) => {
    const estilo = document.createElement("link");
    estilo.rel = "stylesheet";
    estilo.href = `${LEAFLET}/leaflet.min.css`;
    document.head.appendChild(estilo);
    const script = document.createElement("script");
    script.src = `${LEAFLET}/leaflet.min.js`;
    script.onload = () => resolve((window as any).L);
    script.onerror = () => {
      carregando = null;
      reject(new Error("mapa indisponível"));
    };
    document.head.appendChild(script);
  });
  return carregando;
}

/** Centro da cidade pelo nome (serviço gratuito do OpenStreetMap). Sem resposta, fica o Brasil inteiro. */
async function centroDaCidade(cidade: string): Promise<Ponto | null> {
  try {
    const resposta = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(cidade)}`,
    );
    const [achado] = (await resposta.json()) as { lat: string; lon: string }[];
    return achado ? { lat: Number(achado.lat), lng: Number(achado.lon) } : null;
  } catch {
    return null;
  }
}

const BRASIL: Ponto = { lat: -15.78, lng: -47.93 };

/** Folha com um mapa: a pessoa toca onde fica o campo e confirma. */
export function FolhaMapa({
  inicial,
  cidade,
  onEscolher,
  onFechar,
}: {
  /** ponto já marcado antes, se houver */
  inicial: Ponto | null;
  /** usada pra abrir o mapa na cidade da pelada */
  cidade: string;
  onEscolher: (ponto: Ponto) => void;
  onFechar: () => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<any>(null);
  const marcador = useRef<any>(null);
  const [ponto, setPonto] = useState<Ponto | null>(inicial);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "falhou">("carregando");

  function marcar(L: any, novo: Ponto, aproximar = false) {
    if (!mapa.current) return;
    if (marcador.current) marcador.current.setLatLng([novo.lat, novo.lng]);
    else {
      marcador.current = L.circleMarker([novo.lat, novo.lng], {
        radius: 11,
        color: "#ffffff",
        weight: 3,
        fillColor: "#0F3D2E",
        fillOpacity: 1,
      }).addTo(mapa.current);
    }
    if (aproximar) mapa.current.setView([novo.lat, novo.lng], 17);
    setPonto(novo);
  }

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const L = await carregarLeaflet();
        if (!vivo || !caixa.current) return;
        const m = L.map(caixa.current, { zoomControl: true, attributionControl: true });
        mapa.current = m;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(m);
        m.on("click", (e: any) => marcar(L, { lat: e.latlng.lat, lng: e.latlng.lng }));
        if (inicial) marcar(L, inicial, true);
        else {
          m.setView([BRASIL.lat, BRASIL.lng], 4);
          const centro = cidade.trim() ? await centroDaCidade(cidade) : null;
          if (vivo && centro && !marcador.current) m.setView([centro.lat, centro.lng], 14);
        }
        if (vivo) setEstado("pronto");
      } catch {
        if (vivo) setEstado("falhou");
      }
    })();
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
      marcador.current = null;
    };
    // o mapa é montado uma vez só, com o que a folha recebeu ao abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ondeEstou() {
    if (!navigator.geolocation) {
      toast.error("Esse aparelho não informa a localização.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        const L = (window as any).L;
        if (L) marcar(L, { lat: posicao.coords.latitude, lng: posicao.coords.longitude }, true);
      },
      () => toast.error("Não deu pra pegar sua localização. Libera a permissão ou toca no mapa."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
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
        aria-label="Marcar no mapa"
        className="w-full max-w-[480px] space-y-3 rounded-t-3xl bg-card p-4 pb-6"
      >
        <h2 className="text-lg font-extrabold text-foreground">Marcar no mapa</h2>
        <p className="text-xs text-muted-foreground">
          Arraste e aproxime o mapa, depois toque em cima do campo. Se você está lá agora, use “Onde
          estou”.
        </p>
        <div className="relative h-[52dvh] overflow-hidden rounded-2xl bg-secondary">
          {/* isolate: os controles do mapa têm z-index alto e não podem passar por cima da folha */}
          <div ref={caixa} className="isolate size-full" />
          {estado !== "pronto" && (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {estado === "falhou"
                ? "Não deu pra abrir o mapa. Confere a internet, ou cole o link do local."
                : "Abrindo o mapa..."}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={estado !== "pronto"}
            onClick={ondeEstou}
          >
            <LocateFixed className="mr-2 size-4" /> Onde estou
          </Button>
          <Button
            className="flex-1"
            disabled={!ponto}
            onClick={() => {
              if (ponto) onEscolher(ponto);
            }}
          >
            Usar este ponto
          </Button>
        </div>
        <Button variant="ghost" className="w-full" onClick={onFechar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
