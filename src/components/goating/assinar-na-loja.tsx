import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { useSession } from "@/hooks/use-session";
import { usePremium } from "@/hooks/use-premium";
import { Button } from "@/components/ui/button";
import {
  comprarNaLoja,
  gerenciarNaLoja,
  nomeDaLoja,
  planosDaLoja,
  restaurarCompras,
  type PlanoDaLoja,
} from "@/lib/compras";
import { abrirForaDoApp } from "@/lib/nativo";
import { cn } from "@/lib/utils";

/** Termos de uso padrão da Apple pra assinaturas (a App Store pede o link na tela de compra). */
const TERMOS_APPLE = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

/**
 * Cartão de assinatura dentro do app: a compra é pela loja do celular (Google Play ou App
 * Store), com os preços que a loja mostra. Quem já assina pela loja vê quando renova e o
 * botão de gerenciar na loja; quem assinou pelo site só vê que o Premium está ativo.
 */
export function AssinarNaLoja({
  assinaturaDaLoja,
}: {
  /** assinatura da loja dessa conta, se tiver (vem da tabela assinaturas_lojas) */
  assinaturaDaLoja: { expira_em: string | null; renova: boolean; loja: string } | null;
}) {
  const queryClient = useQueryClient();
  const { userId } = useSession();
  const { premium } = usePremium();
  const [tipo, setTipo] = useState<PlanoDaLoja["tipo"]>("mensal");
  const [comprando, setComprando] = useState(false);
  const [esperando, setEsperando] = useState(false);

  const planos = useQuery({
    queryKey: ["planos-da-loja", userId],
    enabled: !!userId && !premium,
    staleTime: 5 * 60_000,
    queryFn: () => planosDaLoja(userId!),
  });

  // depois da compra, o servidor liga o Premium em alguns segundos: fica conferindo até ligar
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
      void queryClient.invalidateQueries({ queryKey: ["assinatura-loja", userId] });
      if (vezes >= 20) {
        clearInterval(id);
        setEsperando(false);
        toast("A loja confirmou a compra. O Premium liga em instantes.");
      }
    }, 2000);
    return () => clearInterval(id);
  }, [esperando, premium, queryClient, userId]);

  const escolhido = planos.data?.find((p) => p.tipo === tipo) ?? planos.data?.[0];
  const loja = nomeDaLoja();

  async function assinar() {
    if (!userId || !escolhido) return;
    setComprando(true);
    try {
      const resultado = await comprarNaLoja(userId, escolhido);
      if (resultado === "comprou") setEsperando(true);
    } catch {
      toast.error(`Não deu pra concluir a compra na ${loja}. Tenta de novo em instantes.`);
    } finally {
      setComprando(false);
    }
  }

  async function restaurar() {
    if (!userId) return;
    setComprando(true);
    try {
      await restaurarCompras(userId);
      toast.success("Pronto! Se essa conta da loja tiver assinatura, o Premium volta já já.");
      setEsperando(true);
    } catch {
      toast.error("Não deu pra restaurar agora.");
    } finally {
      setComprando(false);
    }
  }

  if (esperando && !premium) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-tier-ouro/15 p-4">
        <Loader2 className="size-5 animate-spin text-tier-ouro" />
        <div>
          <p className="text-sm font-bold text-foreground">Compra confirmada na {loja}!</p>
          <p className="text-xs text-muted-foreground">Ativando seu Premium…</p>
        </div>
      </div>
    );
  }

  if (premium) {
    const fim = assinaturaDaLoja?.expira_em;
    return (
      <div className="space-y-3 rounded-2xl bg-tier-ouro/15 p-4 text-center">
        <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-foreground">
          <Crown className="size-4 fill-tier-ouro text-tier-ouro" /> Você é Premium
        </p>
        {assinaturaDaLoja && fim ? (
          <>
            <p className="text-xs text-muted-foreground">
              {assinaturaDaLoja.renova ? "Renova em " : "Seu Premium termina em "}
              {new Date(fim).toLocaleDateString("pt-BR")} · assinatura pela{" "}
              {assinaturaDaLoja.loja === "app_store" ? "App Store" : "Google Play"}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => userId && void gerenciarNaLoja(userId)}
            >
              Gerenciar assinatura
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Sua assinatura está ativa nessa conta.</p>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-3 rounded-3xl border-2 border-tier-ouro/60 bg-card p-4 shadow-[var(--shadow-card)]">
      {planos.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : !planos.data?.length ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Não deu pra carregar os planos da {loja}. Confere a internet e tenta de novo.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {planos.data.map((p) => (
              <button
                key={p.tipo}
                type="button"
                aria-pressed={escolhido?.tipo === p.tipo}
                onClick={() => setTipo(p.tipo)}
                className={cn(
                  "relative rounded-2xl border-2 px-3 py-3 text-left transition-colors",
                  escolhido?.tipo === p.tipo ? "border-tier-ouro bg-tier-ouro/10" : "border-border",
                )}
              >
                <span className="block text-xs font-bold text-muted-foreground uppercase">
                  {p.tipo === "mensal" ? "Mensal" : "Anual"}
                </span>
                <span className="block text-lg font-black text-foreground">
                  {p.preco}
                  <span className="text-xs font-semibold text-muted-foreground">
                    {p.tipo === "mensal" ? "/mês" : "/ano"}
                  </span>
                </span>
                {p.promocao && (
                  <span className="absolute -top-2.5 right-2 rounded-full bg-tier-ouro px-2 py-0.5 text-[10px] font-extrabold text-[#3A2A05]">
                    1º mês {p.promocao}
                  </span>
                )}
              </button>
            ))}
          </div>

          {escolhido?.promocao && (
            <p className="text-center text-xs text-foreground">
              Lançamento: <b>1º mês por {escolhido.promocao}</b>, depois {escolhido.preco}/mês.
            </p>
          )}

          <Button
            className="w-full bg-tier-ouro font-extrabold text-[#3A2A05] hover:bg-tier-ouro/90"
            size="lg"
            disabled={comprando || !escolhido}
            onClick={() => void assinar()}
          >
            {comprando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : escolhido?.promocao ? (
              `Assinar por ${escolhido.promocao} no 1º mês`
            ) : (
              `Assinar por ${escolhido?.preco}${escolhido?.tipo === "anual" ? "/ano" : "/mês"}`
            )}
          </Button>
        </>
      )}

      {/* o que as lojas exigem na tela de assinatura */}
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        Assinatura com renovação automática, cobrada na sua conta da {loja} ao confirmar. Renova
        sozinha no fim de cada período, a não ser que você cancele até 24 horas antes, nas
        assinaturas da {loja}.{" "}
        {Capacitor.getPlatform() === "ios" && (
          <>
            <button
              type="button"
              onClick={() => void abrirForaDoApp(TERMOS_APPLE)}
              className="font-semibold underline"
            >
              Termos de uso
            </button>{" "}
            ·{" "}
          </>
        )}
        <Link to="/privacidade" className="font-semibold underline">
          Política de privacidade
        </Link>
      </p>
      <button
        type="button"
        disabled={comprando}
        onClick={() => void restaurar()}
        className="w-full text-center text-xs font-semibold text-muted-foreground underline"
      >
        Restaurar compras
      </button>
    </section>
  );
}
