import { useEffect, useRef } from "react";

/**
 * "Não sou um robô" (Cloudflare Turnstile) do cadastro, do login e da entrada como convidado.
 *
 * Só aparece quando a chave pública está configurada (VITE_TURNSTILE_SITE_KEY). Sem a chave,
 * nada é mostrado e nada é exigido: dá pra subir o código antes de ligar a proteção no Supabase.
 */
const CHAVE = (import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined) ?? "";
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const CAPTCHA_LIGADO = CHAVE !== "";

/** Opção pra passar nas chamadas de login/cadastro; vazia enquanto não há comprovante. */
export const comCaptcha = (comprovante: string | null) =>
  comprovante ? { captchaToken: comprovante } : {};

type Turnstile = {
  render: (alvo: HTMLElement, opcoes: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

let carregando: Promise<Turnstile> | null = null;

function carregarTurnstile(): Promise<Turnstile> {
  const pronto = (window as unknown as { turnstile?: Turnstile }).turnstile;
  if (pronto) return Promise.resolve(pronto);
  carregando ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      const t = (window as unknown as { turnstile?: Turnstile }).turnstile;
      if (t) resolve(t);
      else reject(new Error("verificação indisponível"));
    };
    script.onerror = () => {
      carregando = null;
      reject(new Error("verificação indisponível"));
    };
    document.head.appendChild(script);
  });
  return carregando;
}

/**
 * Cada comprovante vale pra uma tentativa só. Pra pedir outro depois de usar,
 * troque a `key` do componente: ele é montado de novo e gera um comprovante novo.
 */
export function Captcha({
  onComprovante,
}: {
  onComprovante: (comprovante: string | null) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  // a função muda a cada renderização de quem usa; o widget só é montado uma vez
  const avisar = useRef(onComprovante);
  avisar.current = onComprovante;

  useEffect(() => {
    if (!CAPTCHA_LIGADO) return;
    let vivo = true;
    let id: string | null = null;
    let turnstile: Turnstile | null = null;
    avisar.current(null);
    void carregarTurnstile()
      .then((t) => {
        if (!vivo || !caixa.current) return;
        turnstile = t;
        id = t.render(caixa.current, {
          sitekey: CHAVE,
          language: "pt-br",
          theme: "light",
          callback: (comprovante: string) => avisar.current(comprovante),
          "expired-callback": () => avisar.current(null),
          "error-callback": () => avisar.current(null),
        });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
      if (id && turnstile) turnstile.remove(id);
    };
  }, []);

  if (!CAPTCHA_LIGADO) return null;
  return <div ref={caixa} className="flex min-h-[65px] justify-center" />;
}
