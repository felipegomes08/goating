import { Capacitor } from "@capacitor/core";

/**
 * O que só existe dentro do app de celular (Android/iOS).
 *
 * No navegador nada daqui roda: quem chama confere `noApp()` antes. Os plugins são
 * carregados só na hora do uso, pra não pesar no site.
 */
export const noApp = () => Capacitor.isNativePlatform();

function emBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] ?? "");
    leitor.onerror = () => reject(new Error("Não deu pra ler a imagem."));
    leitor.readAsDataURL(blob);
  });
}

/** A pessoa fechou a folha de compartilhar sem escolher nada: não é erro. */
const desistiu = (erro: unknown) => erro instanceof Error && /cancel/i.test(erro.message);

/**
 * Abre a folha de compartilhar do sistema com uma imagem. O navegador embutido do app
 * não compartilha arquivo nem baixa imagem gerada na hora, então a imagem vira um
 * arquivo temporário do app e é ele que vai pro WhatsApp e companhia.
 */
export async function compartilharImagemNoApp(blob: Blob, nomeDoArquivo: string) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const { uri } = await Filesystem.writeFile({
    path: nomeDoArquivo,
    data: await emBase64(blob),
    directory: Directory.Cache,
  });
  try {
    await Share.share({ files: [uri] });
    return "compartilhado" as const;
  } catch (erro) {
    if (desistiu(erro)) return "cancelado" as const;
    throw erro;
  }
}

export async function compartilharTextoNoApp(texto: string) {
  const { Share } = await import("@capacitor/share");
  try {
    await Share.share({ text: texto });
    return "compartilhado" as const;
  } catch (erro) {
    if (desistiu(erro)) return "cancelado" as const;
    throw erro;
  }
}

/** Vibra seguindo o padrão [vibra, pausa, vibra...] em milissegundos. No iPhone o navegador não vibra. */
export async function vibrarNoApp(padrao: number | number[]) {
  const { Haptics } = await import("@capacitor/haptics");
  const passos = Array.isArray(padrao) ? padrao : [padrao];
  let espera = 0;
  passos.forEach((duracao, i) => {
    // posições pares vibram, ímpares são pausa
    if (i % 2 === 0 && duracao > 0) {
      setTimeout(() => void Haptics.vibrate({ duration: duracao }).catch(() => undefined), espera);
    }
    espera += duracao;
  });
}

export async function manterTelaLigadaNoApp(ligada: boolean) {
  const { KeepAwake } = await import("@capacitor-community/keep-awake");
  if (ligada) await KeepAwake.keepAwake();
  else await KeepAwake.allowSleep();
}

/**
 * Liga o que o app precisa assim que abre: barra de status verde e o botão "voltar"
 * do Android andando pelo histórico (na primeira tela, ele fecha o app).
 */
export async function iniciarApp() {
  if (!noApp()) return;
  const [{ App }, { StatusBar, Style }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/status-bar"),
  ]);
  // Style.Dark = fundo escuro, ícones claros
  void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
  if (Capacitor.getPlatform() === "android") {
    void StatusBar.setBackgroundColor({ color: "#0F3D2E" }).catch(() => undefined);
  }
  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.exitApp();
  });
}
