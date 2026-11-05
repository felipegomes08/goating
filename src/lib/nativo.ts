import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

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
  // no iPhone o app ocupa a tela toda: o CSS desconta a barra de status (veja .ios-app)
  if (Capacitor.getPlatform() === "ios") document.documentElement.classList.add("ios-app");
  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.exitApp();
  });
}

const CHAVE_TOKEN = "goating-push-token";

/** Como está o registro deste celular pros avisos (aparece em Notificações > Avisos no celular). */
export type EstadoDoPush =
  | { tipo: "desligado" }
  | { tipo: "registrando" }
  | { tipo: "sem-permissao" }
  | { tipo: "ok" }
  | { tipo: "erro"; mensagem: string };

let estadoDoPush: EstadoDoPush = { tipo: "desligado" };
const ouvintesDoEstado = new Set<(e: EstadoDoPush) => void>();
let abrirAviso: (link: string) => void = () => undefined;

/** Aviso que chegou com o app aberto (o Android não mostra na bandeja nesse caso). */
export type AvisoNoApp = {
  titulo: string;
  corpo: string;
  link: string | null;
  chat: string | null;
};
let receberAviso: (aviso: AvisoNoApp) => void = () => undefined;

function mudarEstado(e: EstadoDoPush) {
  estadoDoPush = e;
  ouvintesDoEstado.forEach((f) => f(e));
}

export function lerEstadoDoPush() {
  return estadoDoPush;
}

export function ouvirEstadoDoPush(f: (e: EstadoDoPush) => void) {
  ouvintesDoEstado.add(f);
  return () => {
    ouvintesDoEstado.delete(f);
  };
}

const textoDoErro = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);

/**
 * Avisos no celular (push). Pede permissão uma vez, cria o canal "Avisos do Goating",
 * registra o celular na conta logada e, ao tocar num aviso, abre a tela dele.
 * Sem permissão, segue tudo igual: os avisos continuam no sino.
 */
export async function ligarPushNoApp(
  abrir?: (link: string) => void,
  receber?: (aviso: AvisoNoApp) => void,
) {
  if (!noApp()) return;
  if (abrir) abrirAviso = abrir;
  if (receber) receberAviso = receber;
  mudarEstado({ tipo: "registrando" });
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let permissao = await PushNotifications.checkPermissions();
    if (permissao.receive === "prompt" || permissao.receive === "prompt-with-rationale") {
      permissao = await PushNotifications.requestPermissions();
    }
    if (permissao.receive !== "granted") {
      mudarEstado({ tipo: "sem-permissao" });
      return;
    }
    if (Capacitor.getPlatform() === "android") {
      await PushNotifications.createChannel({
        id: "goating",
        name: "Avisos do Goating",
        description: "Peladas, turma, avaliações e conquistas",
        importance: 4,
        visibility: 1,
        vibration: true,
      }).catch(() => undefined);
    }
    await PushNotifications.removeAllListeners();
    await PushNotifications.addListener("registration", ({ value }) => {
      try {
        localStorage.setItem(CHAVE_TOKEN, value);
      } catch {
        // sem armazenamento: só não dá pra desligar ao sair da conta
      }
      void supabase
        .rpc("registrar_dispositivo", { p_token: value, p_plataforma: Capacitor.getPlatform() })
        .then(({ error }) =>
          mudarEstado(
            error ? { tipo: "erro", mensagem: `salvar: ${error.message}` } : { tipo: "ok" },
          ),
        );
    });
    await PushNotifications.addListener("registrationError", ({ error }) => {
      mudarEstado({ tipo: "erro", mensagem: `registro: ${textoDoErro(error)}` });
    });
    await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const link = (notification.data as { link?: unknown } | undefined)?.link;
      if (typeof link === "string" && link.startsWith("/")) abrirAviso(link);
    });
    await PushNotifications.addListener("pushNotificationReceived", (notification) => {
      const dados = (notification.data ?? {}) as { link?: unknown; chat?: unknown };
      receberAviso({
        titulo: notification.title ?? "Goating",
        corpo: notification.body ?? "",
        link: typeof dados.link === "string" && dados.link.startsWith("/") ? dados.link : null,
        chat: typeof dados.chat === "string" ? dados.chat : null,
      });
    });
    await PushNotifications.register();
  } catch (e) {
    // celular sem o serviço do Google ou Firebase não configurado: fica só o sino
    mudarEstado({ tipo: "erro", mensagem: textoDoErro(e) });
  }
}

/** Ao sair da conta: este celular para de receber os avisos dela. */
export async function esquecerPushNoApp() {
  if (!noApp()) return;
  let token: string | null = null;
  try {
    token = localStorage.getItem(CHAVE_TOKEN);
  } catch {
    return;
  }
  if (token) await supabase.rpc("esquecer_dispositivo", { p_token: token });
}

/**
 * Abre um endereço de fora (pagamento do Stripe, portal da assinatura). No app vai pro
 * navegador do celular, que volta pro site no fim; no site é a própria aba.
 */
export async function abrirForaDoApp(url: string) {
  if (!noApp()) {
    window.location.href = url;
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}

/**
 * ID do cliente OAuth "Aplicativo da Web" do Google Cloud (projeto Goating). Não é segredo: é o
 * mesmo que fica no Supabase (Authentication > Providers > Google) e no login nativo do app.
 */
const GOOGLE_WEB_CLIENT_ID =
  "583778341603-6g00f6jivv35cjgp1dqki5ihs0quls3u.apps.googleusercontent.com";

/** ID do cliente OAuth "iOS" do mesmo projeto (pacote br.com.goating.app). Também não é segredo. */
const GOOGLE_IOS_CLIENT_ID =
  "583778341603-6o6u9ras9ep5egv631lgb32027kpog41.apps.googleusercontent.com";

/**
 * Entrar com Google dentro do app: o Google não aceita login por página web dentro de app, então
 * abre a janelinha de contas do próprio celular e o token dela vira a sessão no Supabase.
 */
export async function entrarComGoogleNoApp() {
  if (!GOOGLE_WEB_CLIENT_ID) throw new Error("Login com Google ainda não configurado no app.");
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  await SocialLogin.initialize({
    google: {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iOSClientId: GOOGLE_IOS_CLIENT_ID,
      iOSServerClientId: GOOGLE_WEB_CLIENT_ID,
      mode: "online",
    },
  });
  // e-mail e perfil já vêm por padrão. No Android, passar "scopes" exige mexer na MainActivity
  // (o plugin dá erro "You CANNOT use scopes without modifying the main activity").
  const { result } = await SocialLogin.login({
    provider: "google",
    options: Capacitor.getPlatform() === "ios" ? { scopes: ["email", "profile"] } : {},
  });
  const idToken = "idToken" in result ? result.idToken : null;
  if (!idToken) throw new Error("O Google não devolveu o login.");
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken });
  if (error) throw error;
}

/** O botão "Entrar com a Apple" aparece só no app do iPhone (a App Store exige ao lado do Google). */
export const temLoginApple = () => noApp() && Capacitor.getPlatform() === "ios";

async function sha256Hex(texto: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Entrar com a Apple no iPhone: a janela da Apple (com Face ID) devolve um token que vira a
 * sessão no Supabase. A Apple recebe o nonce já embaralhado (sha256) e o Supabase o original,
 * pra conferir que o token foi feito pra este login.
 */
export async function entrarComAppleNoApp() {
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  await SocialLogin.initialize({ apple: {} });
  const nonce = crypto.randomUUID();
  const { result } = await SocialLogin.login({
    provider: "apple",
    options: { scopes: ["name", "email"], nonce: await sha256Hex(nonce) },
  });
  const idToken = "idToken" in result ? result.idToken : null;
  if (!idToken) throw new Error("A Apple não devolveu o login.");
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: idToken,
    nonce,
  });
  if (error) throw error;

  // a Apple só manda o nome na primeira vez e não o põe no token: a conta nova nasce com o começo
  // do e-mail como nome, e aqui ele vira o nome de verdade
  const perfil = "profile" in result ? result.profile : null;
  const nome = [perfil?.givenName, perfil?.familyName].filter(Boolean).join(" ").trim();
  const user = data.user;
  if (!nome || !user) return;
  const { data: atual } = await supabase
    .from("profiles")
    .select("nome_exibicao")
    .eq("id", user.id)
    .maybeSingle();
  if (atual && atual.nome_exibicao === (user.email ?? "").split("@")[0]) {
    await supabase
      .from("profiles")
      .update({ nome_exibicao: nome.slice(0, 40) })
      .eq("id", user.id);
  }
}
