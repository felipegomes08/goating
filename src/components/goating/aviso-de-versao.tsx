import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { noApp } from "@/lib/nativo";

/** Onde atualizar: abre direto o app da loja (o WebView passa esses links pro sistema). */
const LOJA = {
  ios: "itms-apps://apps.apple.com/app/id6829370272",
  android: "market://details?id=br.com.goating.app",
};

const CHAVE_ADIADA = "goating-versao-adiada";

/** -1 se a < b, 0 se iguais, 1 se a > b ("1.0.2" contra "1.0.10"). */
export function compararVersoes(a: string, b: string) {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

type Versoes = { versao_atual: string; versao_minima: string };

/**
 * No app do celular: se a loja já tem uma versão mais nova que a instalada, mostra o aviso com o
 * botão pra atualizar. "Depois" esconde até sair outra versão; abaixo da versão mínima não fecha.
 * A versão da loja vem da tabela versoes_do_app (atualizada quando a versão nova vai pro ar).
 */
export function AvisoDeVersao() {
  const [aviso, setAviso] = useState<{ nova: string; obrigatoria: boolean } | null>(null);
  const plataforma = Capacitor.getPlatform() === "ios" ? "ios" : "android";

  useEffect(() => {
    if (!noApp()) return;
    let cancelado = false;
    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const [{ version }, { data }] = await Promise.all([
          App.getInfo(),
          supabase
            .from("versoes_do_app" as never)
            .select("versao_atual, versao_minima")
            .eq("plataforma", plataforma)
            .maybeSingle<Versoes>(),
        ]);
        if (cancelado || !data || compararVersoes(version, data.versao_atual) >= 0) return;
        const obrigatoria = compararVersoes(version, data.versao_minima) < 0;
        let adiada: string | null = null;
        try {
          adiada = localStorage.getItem(CHAVE_ADIADA);
        } catch {
          // sem armazenamento: mostra
        }
        if (!obrigatoria && adiada === data.versao_atual) return;
        setAviso({ nova: data.versao_atual, obrigatoria });
      } catch {
        // sem internet ou sem resposta: tenta de novo na próxima abertura
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [plataforma]);

  if (!aviso) return null;

  function depois() {
    try {
      localStorage.setItem(CHAVE_ADIADA, aviso!.nova);
    } catch {
      // sem armazenamento: só fecha
    }
    setAviso(null);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50">
      <div
        role="dialog"
        aria-label="Nova versão disponível"
        className="w-full max-w-[480px] space-y-3 rounded-t-3xl bg-card p-5 pb-[max(var(--sa-bottom),1.5rem)] text-center"
      >
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-mint-soft">
          <Download className="size-6 text-primary" />
        </span>
        <h2 className="text-lg font-extrabold text-foreground">Nova versão disponível</h2>
        <p className="text-sm text-muted-foreground">
          {aviso.obrigatoria
            ? "Essa versão do Goating parou de funcionar. Atualiza pra continuar usando."
            : `O Goating ${aviso.nova} já está na ${plataforma === "ios" ? "App Store" : "Google Play"}, com correções e novidades.`}
        </p>
        <Button className="w-full" onClick={() => (window.location.href = LOJA[plataforma])}>
          Atualizar agora
        </Button>
        {!aviso.obrigatoria && (
          <Button variant="ghost" className="w-full" onClick={depois}>
            Depois
          </Button>
        )}
      </div>
    </div>
  );
}
