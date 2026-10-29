import { Capacitor } from "@capacitor/core";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";
import { abrirForaDoApp, noApp } from "@/lib/nativo";

/**
 * Premium comprado dentro do app, pela Google Play ou pela App Store, através do RevenueCat.
 * No site a compra continua pelo Stripe. A confirmação que liga o Premium vem pelo servidor
 * (função revenuecat-webhook), igual ao Stripe: o app só abre a compra da loja.
 *
 * As chaves abaixo são as chaves PÚBLICAS do SDK (Project settings > API keys no RevenueCat,
 * começam com "goog_" e "appl_"). Podem ficar no código. Vazia = compra no app desligada.
 */
const CHAVES_REVENUECAT = {
  android: "",
  ios: "",
};

const chave = () =>
  Capacitor.getPlatform() === "ios" ? CHAVES_REVENUECAT.ios : CHAVES_REVENUECAT.android;

/** true dentro do app, quando a loja daquele celular já está configurada. */
export const compraPelaLoja = () => noApp() && !!chave();

/** Nome da loja do celular, pros textos. */
export const nomeDaLoja = () => (Capacitor.getPlatform() === "ios" ? "App Store" : "Google Play");

let contaConfigurada: string | null = null;

async function plugin(userId: string) {
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  if (contaConfigurada === null) {
    // o id da compra é o id da conta do Goating: é por ele que o servidor liga o Premium
    await Purchases.configure({ apiKey: chave(), appUserID: userId });
  } else if (contaConfigurada !== userId) {
    await Purchases.logIn({ appUserID: userId });
  }
  contaConfigurada = userId;
  return Purchases;
}

export type PlanoDaLoja = {
  tipo: "mensal" | "anual";
  /** preço do jeito que a loja mostra ("R$ 9,90") */
  preco: string;
  /** oferta de entrada que a loja liberou pra essa pessoa (o 1º mês por R$ 0,99) */
  promocao: string | null;
  pacote: PurchasesPackage;
};

/** Os planos à venda na loja (mensal e anual), com o preço e a promoção de quem está vendo. */
export async function planosDaLoja(userId: string): Promise<PlanoDaLoja[]> {
  const Purchases = await plugin(userId);
  const { current } = await Purchases.getOfferings();
  const planos: PlanoDaLoja[] = [];
  for (const pacote of current?.availablePackages ?? []) {
    const tipo =
      pacote.packageType === "MONTHLY"
        ? "mensal"
        : pacote.packageType === "ANNUAL"
          ? "anual"
          : null;
    if (!tipo) continue;
    planos.push({
      tipo,
      preco: pacote.product.priceString,
      promocao: pacote.product.introPrice?.priceString ?? null,
      pacote,
    });
  }
  // mensal primeiro, anual depois
  return planos.sort((a, b) => Number(a.tipo === "anual") - Number(b.tipo === "anual"));
}

/** Abre a compra da loja. "cancelou" quando a pessoa fechou a janela da loja sem comprar. */
export async function comprarNaLoja(userId: string, plano: PlanoDaLoja) {
  const Purchases = await plugin(userId);
  try {
    await Purchases.purchasePackage({ aPackage: plano.pacote });
    return "comprou" as const;
  } catch (e) {
    if ((e as { userCancelled?: boolean | null }).userCancelled) return "cancelou" as const;
    throw e;
  }
}

/** "Restaurar compras": a loja reenvia as assinaturas dessa conta da loja pro servidor. */
export async function restaurarCompras(userId: string) {
  const Purchases = await plugin(userId);
  await Purchases.restorePurchases();
}

/** Abre a tela de assinaturas da loja (cancelar, trocar de plano, forma de pagamento). */
export async function gerenciarNaLoja(userId: string) {
  let url: string | null = null;
  try {
    const Purchases = await plugin(userId);
    url = (await Purchases.getCustomerInfo()).customerInfo.managementURL;
  } catch {
    // sem resposta do RevenueCat: cai na página padrão da loja
  }
  await abrirForaDoApp(
    url ??
      (Capacitor.getPlatform() === "ios"
        ? "https://apps.apple.com/account/subscriptions"
        : "https://play.google.com/store/account/subscriptions"),
  );
}

/** Ao sair da conta: a próxima compra nesse celular não vai pra conta antiga. */
export async function sairDasCompras() {
  if (contaConfigurada === null) return;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    await Purchases.logOut();
  } catch {
    // já estava sem conta no RevenueCat
  }
  contaConfigurada = null;
}
