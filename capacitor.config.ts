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
};

export default config;
