import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { usePremium } from "@/hooks/use-premium";
import { Button } from "@/components/ui/button";
import { abrirForaDoApp, noApp } from "@/lib/nativo";
import { compraPelaLoja } from "@/lib/compras";
import { AssinarNaLoja } from "@/components/goating/assinar-na-loja";
import { PRECOS_PREMIUM, promocaoNoAr } from "@/lib/premium";
import { origemDoSite } from "@/lib/site";
import { cn } from "@/lib/utils";

type Plano = "mensal" | "anual";

/**
 * Cartão de assinatura da tela do Premium. No site, quem não é Premium escolhe mensal ou anual
 * e vai pro pagamento do Stripe; quem voltou do pagamento vê o Premium ativando; quem já assina
 * vê quando renova e o botão de gerenciar (cancelar, trocar cartão). Dentro do app a compra é
 * pela loja do celular (AssinarNaLoja): as lojas não deixam o app abrir outro pagamento.
 */
export function AssinarPremium({ voltouDoPagamento }: { voltouDoPagamento: boolean }) {
  const queryClient = useQueryClient();
  const { userId } = useSession();
  const { premium, ate } = usePremium();
  const [plano, setPlano] = useState<Plano>("mensal");
  const [abrindo, setAbrindo] = useState(false);
  const [esperando, setEsperando] = useState(voltouDoPagamento);

  const assinatura = useQuery({
    queryKey: ["assinatura", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assinaturas")
        .select("status, plano, periodo_fim, cancela_no_fim, usou_promocao")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // quem volta do pagamento (no app, voltando do navegador) vê o Premium assim que ele liga
  useEffect(() => {
    const atualizar = () => {
      void queryClient.invalidateQueries({ queryKey: ["perfil", userId] });
      void queryClient.invalidateQueries({ queryKey: ["assinatura", userId] });
    };
    const aoVoltar = () => {
      if (document.visibilityState === "visible") atualizar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [queryClient, userId]);

  useEffect(() => {
    if (!esperando) return;
    if (premium) {
      setEsperando(false);
      toast.success("Premium ativado! 👑");
      return;
    }
    let vezes = 0;
    const id = setInterval(() => {
      vezes += 1;
      void queryClient.invalidateQueries({ queryKey: ["perfil", userId] });
      void queryClient.invalidateQueries({ queryKey: ["assinatura", userId] });
      if (vezes >= 15) {
        clearInterval(id);
        setEsperando(false);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [esperando, premium, queryClient, userId]);

  // assinatura feita no app (Google Play / App Store), se tiver
  const assinaturaLoja = useQuery({
    queryKey: ["assinatura-loja", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assinaturas_lojas")
        .select("loja, expira_em, renova")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const pelaLoja =
    !!assinaturaLoja.data?.expira_em &&
    new Date(assinaturaLoja.data.expira_em).getTime() > Date.now();

  const comPromocao = plano === "mensal" && promocaoNoAr() && !assinatura.data?.usou_promocao;
  const assina =
    !!assinatura.data && ["active", "trialing", "past_due"].includes(assinatura.data.status);

  async function chamar(funcao: "criar-assinatura" | "gerenciar-assinatura") {
    setAbrindo(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ url?: string; erro?: string }>(
        funcao,
        { body: { plano, origem: origemDoSite() } },
      );
      if (error || !data?.url) throw new Error(data?.erro ?? "sem link");
      await abrirForaDoApp(data.url);
    } catch {
      toast.error("Não deu pra abrir o pagamento agora. Tenta de novo em instantes.");
    } finally {
      setAbrindo(false);
    }
  }

  if (noApp()) {
    if (compraPelaLoja()) {
      return <AssinarNaLoja assinaturaDaLoja={pelaLoja ? (assinaturaLoja.data ?? null) : null} />;
    }
    // app sem a loja configurada: nunca abre o pagamento do site (as lojas não deixam)
    return (
      <p className="rounded-2xl bg-tier-ouro/15 p-4 text-center text-sm font-semibold text-foreground">
        {premium ? "Você é Premium 👑" : "A assinatura pelo app chega em breve."}
      </p>
    );
  }

  if (esperando && !premium) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-tier-ouro/15 p-4">
        <Loader2 className="size-5 animate-spin text-tier-ouro" />
        <div>
          <p className="text-sm font-bold text-foreground">Pagamento recebido!</p>
          <p className="text-xs text-muted-foreground">Ativando seu Premium…</p>
        </div>
      </div>
    );
  }

  if (premium) {
    const fim = assinatura.data?.periodo_fim ?? ate;
    return (
      <div className="space-y-3 rounded-2xl bg-tier-ouro/15 p-4 text-center">
        <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-foreground">
          <Crown className="size-4 fill-tier-ouro text-tier-ouro" /> Você é Premium
        </p>
        {assina && fim && (
          <p className="text-xs text-muted-foreground">
            {assinatura.data?.cancela_no_fim ? "Seu Premium termina em " : "Renova em "}
            {new Date(fim).toLocaleDateString("pt-BR")}
            {assinatura.data?.plano === "anual" ? " · plano anual" : " · plano mensal"}
          </p>
        )}
        {pelaLoja && !assina && (
          <p className="text-xs text-muted-foreground">
            Assinatura feita pelo app (
            {assinaturaLoja.data?.loja === "app_store" ? "App Store" : "Google Play"}). Pra cancelar
            ou trocar de plano, use as assinaturas da loja no celular.
          </p>
        )}
        {assina && (
          <Button
            variant="outline"
            className="w-full"
            disabled={abrindo}
            onClick={() => void chamar("gerenciar-assinatura")}
          >
            {abrindo ? <Loader2 className="size-4 animate-spin" /> : "Gerenciar assinatura"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-3xl border-2 border-tier-ouro/60 bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-2 gap-2">
        {(["mensal", "anual"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={plano === p}
            onClick={() => setPlano(p)}
            className={cn(
              "relative rounded-2xl border-2 px-3 py-3 text-left transition-colors",
              plano === p ? "border-tier-ouro bg-tier-ouro/10" : "border-border",
            )}
          >
            <span className="block text-xs font-bold text-muted-foreground uppercase">
              {p === "mensal" ? "Mensal" : "Anual"}
            </span>
            <span className="block text-lg font-black text-foreground">
              {p === "mensal" ? PRECOS_PREMIUM.mensal : PRECOS_PREMIUM.anual}
              <span className="text-xs font-semibold text-muted-foreground">
                {p === "mensal" ? "/mês" : "/ano"}
              </span>
            </span>
            {p === "anual" && (
              <span className="block text-[11px] font-semibold text-primary">
                equivale a {PRECOS_PREMIUM.anualPorMes}/mês
              </span>
            )}
            {p === "mensal" && promocaoNoAr() && !assinatura.data?.usou_promocao && (
              <span className="absolute -top-2.5 right-2 rounded-full bg-tier-ouro px-2 py-0.5 text-[10px] font-extrabold text-[#3A2A05]">
                1º mês {PRECOS_PREMIUM.promocao}
              </span>
            )}
          </button>
        ))}
      </div>

      {comPromocao && (
        <p className="text-center text-xs text-foreground">
          Lançamento: <b>1º mês por {PRECOS_PREMIUM.promocao}</b>, depois {PRECOS_PREMIUM.mensal}
          /mês. Válido pra quem assinar até 30/11.
        </p>
      )}

      <Button
        className="w-full bg-tier-ouro font-extrabold text-[#3A2A05] hover:bg-tier-ouro/90"
        size="lg"
        disabled={abrindo || !userId}
        onClick={() => void chamar("criar-assinatura")}
      >
        {abrindo ? (
          <Loader2 className="size-4 animate-spin" />
        ) : comPromocao ? (
          `Assinar por ${PRECOS_PREMIUM.promocao} no 1º mês`
        ) : plano === "mensal" ? (
          `Assinar por ${PRECOS_PREMIUM.mensal}/mês`
        ) : (
          `Assinar por ${PRECOS_PREMIUM.anual}/ano`
        )}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">
        Pagamento seguro com cartão pelo Stripe. Cancele quando quiser, sem multa.
      </p>
    </section>
  );
}
