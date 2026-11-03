import { Capacitor } from "@capacitor/core";

/**
 * Endereço público do Goating.
 *
 * No navegador o endereço é o da própria página. Dentro do app (Android/iOS) a página
 * mora em "localhost" no aparelho, então um link montado a partir dela não abriria em
 * lugar nenhum: convite, confirmação de e-mail e rodapé das imagens usam o site.
 */
const SITE = "https://goating.com.br";

/** "https://..." pra montar links que outras pessoas vão abrir. */
export const origemDoSite = () => (Capacitor.isNativePlatform() ? SITE : window.location.origin);

/** Só o nome do site, pro rodapé dos pôsteres e cartões. */
export const hostDoSite = () =>
  Capacitor.isNativePlatform() ? new URL(SITE).host : window.location.host;

/**
 * Páginas do Goating nas lojas, pros botões de baixar no site. Vazio = o botão não aparece:
 * preencher quando cada loja publicar o app.
 */
export const LOJAS = {
  /** https://play.google.com/store/apps/details?id=br.com.goating.app */
  playStore: "",
  /** https://apps.apple.com/br/app/id... (o número sai no App Store Connect) */
  appStore: "",
};
