// Build do app de celular: gera dist/client com um index.html estático (sem servidor),
// que é o que o Capacitor empacota no Android e no iOS.
// É um script (e não "VAR=1 vite build" no package.json) porque essa forma de passar
// variável não funciona no Windows.
import { spawnSync } from "node:child_process";

const resultado = spawnSync("npx", ["vite", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, GOATING_NATIVO: "1" },
});
process.exit(resultado.status ?? 1);
