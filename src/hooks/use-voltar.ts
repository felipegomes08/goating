import { useRouter } from "@tanstack/react-router";

/**
 * Botão "voltar" que segue o caminho que a pessoa fez. Só cai no destino fixo
 * quando não tem pra onde voltar (abriu a tela direto por um link).
 */
export function useVoltar(semHistorico: () => void) {
  const router = useRouter();
  return () => {
    if (router.history.canGoBack()) router.history.back();
    else semHistorico();
  };
}
