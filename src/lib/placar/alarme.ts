/** Apito do fim do tempo, vibração e tela sempre ligada durante o jogo. */

import { manterTelaLigadaNoApp, noApp, vibrarNoApp } from "@/lib/nativo";

let audio: AudioContext | null = null;
let repeticao: ReturnType<typeof setInterval> | null = null;
let trava: WakeLockSentinel | null = null;

/** Deixa a tela voltar a apagar sozinha (o jogo parou ou a pessoa saiu do placar). */
export function soltarTela() {
  if (noApp()) {
    void manterTelaLigadaNoApp(false).catch(() => undefined);
    return;
  }
  void trava?.release().catch(() => undefined);
  trava = null;
}

/** Navegador só libera som depois de um toque: chamar em todo clique do cronômetro. */
export function liberarAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    // sem áudio nesse navegador: o alarme fica só visual e na vibração
  }
}

function apitar() {
  liberarAudio();
  if (audio) {
    const agora = audio.currentTime;
    for (let k = 0; k < 3; k++) {
      const inicio = agora + k * 0.3;
      const oscilador = audio.createOscillator();
      const ganho = audio.createGain();
      oscilador.type = "square";
      oscilador.frequency.value = 1760;
      ganho.gain.setValueAtTime(0.0001, inicio);
      ganho.gain.exponentialRampToValueAtTime(0.5, inicio + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.22);
      oscilador.connect(ganho).connect(audio.destination);
      oscilador.start(inicio);
      oscilador.stop(inicio + 0.27);
    }
  }
  vibrar([400, 150, 400]);
}

export function vibrar(padrao: number | number[]) {
  if (noApp()) {
    // 0 no navegador quer dizer "pare de vibrar"; no app cada vibração já é curta e acaba sozinha
    if (padrao !== 0) void vibrarNoApp(padrao).catch(() => undefined);
    return;
  }
  try {
    navigator.vibrate?.(padrao);
  } catch {
    // aparelho sem vibração
  }
}

/** Apita sem parar até pararAlarme(). */
export function tocarAlarme() {
  if (repeticao) return;
  apitar();
  repeticao = setInterval(apitar, 1400);
}

export function pararAlarme() {
  if (!repeticao) return;
  clearInterval(repeticao);
  repeticao = null;
  vibrar(0);
}

export async function manterTelaLigada() {
  if (noApp()) {
    await manterTelaLigadaNoApp(true).catch(() => undefined);
    return;
  }
  try {
    if (!("wakeLock" in navigator) || trava) return;
    trava = await navigator.wakeLock.request("screen");
    trava.addEventListener("release", () => {
      trava = null;
    });
  } catch {
    // economia de bateria ou navegador sem suporte: a tela pode apagar
  }
}
