/** Localização da pelada: link colado pelo organizador ou ponto marcado no mapa. */

export type Ponto = { lat: number; lng: number };

/** Só endereço de internet de verdade: nada de "javascript:" ou texto solto virando link. */
export function linkValido(texto: string) {
  return /^https?:\/\/\S+\.\S+/i.test(texto.trim());
}

/** Link do Google Maps pra um ponto marcado no mapa. É esse texto que fica gravado na pelada. */
export function linkDoPonto({ lat, lng }: Ponto) {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** Acha latitude e longitude dentro de um link de mapa, nos formatos mais comuns. */
export function pontoDoLink(link: string | null | undefined): Ponto | null {
  if (!link) return null;
  const achado =
    /[?&](?:query|q|ll|destination)=(-?\d{1,2}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i.exec(link) ??
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(link) ??
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/.exec(link);
  if (!achado) return null;
  const lat = Number(achado[1]);
  const lng = Number(achado[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/**
 * Pra onde o toque no local leva:
 * - link com coordenadas (ou marcado no mapa): Maps e Waze direto no ponto;
 * - link sem coordenadas (encurtado, de outro app): abre o próprio link;
 * - sem link: busca pelo nome do local e a cidade.
 */
export function destinosDoLocal(pelada: {
  local: string;
  cidade: string;
  local_link: string | null;
}) {
  const ponto = pontoDoLink(pelada.local_link);
  if (ponto) {
    return {
      maps: linkDoPonto(ponto),
      waze: `https://waze.com/ul?ll=${ponto.lat},${ponto.lng}&navigate=yes`,
      direto: null,
    };
  }
  if (pelada.local_link && linkValido(pelada.local_link)) {
    return { maps: null, waze: null, direto: pelada.local_link };
  }
  const busca = encodeURIComponent(`${pelada.local}, ${pelada.cidade}`);
  return {
    maps: `https://www.google.com/maps/search/?api=1&query=${busca}`,
    waze: `https://waze.com/ul?q=${busca}&navigate=yes`,
    direto: null,
  };
}
