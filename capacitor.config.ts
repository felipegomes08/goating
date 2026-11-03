import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Identidade do app nas lojas (domínio goating.com.br ao contrário).
  // Depois de publicado não dá mais pra trocar.
  appId: "br.com.goating.app",
  appName: "Goating",
  // saída do `npm run build:nativo`
  webDir: "dist/client",
  // verde do Goating enquanto o app carrega, em vez de um clarão branco
  backgroundColor: "#0F3D2E",
  ios: {
    // o app ocupa a tela toda e o CSS desconta o entalhe e a barra de gestos (env(safe-area-*));
    // com "always" o iPhone ajustava a margem só depois de arrastar e a tela ficava solta
    contentInset: "never",
  },
  plugins: {
    // login com Google (e Apple no iPhone, quando a conta da Apple entrar); o resto fica de fora
    // pra não engordar o app
    SocialLogin: {
      providers: { google: true, apple: true, facebook: false, twitter: false },
      logLevel: 1,
    },
    // tela de abertura: verde do Goating, some sozinha assim que o app carrega
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: "#0F3D2E",
      showSpinner: false,
    },
  },
};

export default config;
