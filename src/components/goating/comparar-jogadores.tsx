import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FolhaPremium } from "@/components/goating/cadeado";
import { carregarMedias, type AtributoExibido } from "@/lib/atributos";
import { cn } from "@/lib/utils";

/**
 * Botão "Comparar comigo" do perfil de outro jogador (Premium): as notas dos dois lado a lado,
 * nas habilidades da posição dele. O lado de quem não é Premium aparece escondido.
 */
export function CompararJogadores({
  meuId,
  premium,
  nome,
  posicao,
  overall,
  meuOverall,
  atributos,
  ocultas,
}: {
  meuId: string;
  premium: boolean;
  nome: string;
  posicao: string | null;
  overall: number;
  meuOverall: number;
  /** as notas dele (já carregadas no perfil) */
  atributos: AtributoExibido[];
  /** ele não é Premium: as notas dele não aparecem */
  ocultas: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const minhas = useQuery({
    queryKey: ["medias-comparar", meuId, posicao],
    enabled: aberto && premium,
    queryFn: () => carregarMedias(meuId, posicao),
  });

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setAberto(true)}
        className="mx-auto mt-2 flex text-xs font-semibold text-mint hover:bg-mint/10 hover:text-mint"
      >
        <GitCompareArrows className="size-4" /> Comparar comigo
      </Button>

      {aberto && !premium && (
        <FolhaPremium recurso="Comparar jogadores" onFechar={() => setAberto(false)} />
      )}

      {aberto && premium && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAberto(false);
          }}
        >
          <div
            role="dialog"
            aria-label={`Comparar com ${nome}`}
            className="w-full max-w-[480px] space-y-3 rounded-t-3xl bg-card p-4 pb-6"
          >
            <h2 className="text-lg font-extrabold text-foreground">Você × {nome}</h2>
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2 text-sm">
              <span className="text-xs font-bold text-muted-foreground uppercase">Overall</span>
              <span className="w-12 text-center text-lg font-black tabular-nums">{meuOverall}</span>
              <span className="w-12 text-center text-lg font-black tabular-nums">{overall}</span>
              {atributos.map((a) => {
                const meu = minhas.data?.atributos.find((m) => m.chave === a.chave)?.valor;
                const dele = ocultas ? null : a.valor;
                const ganho = meu != null && dele != null ? meu - dele : 0;
                return (
                  <Linha key={a.chave} nome={a.nome} meu={meu ?? null} dele={dele} ganho={ganho} />
                );
              })}
            </div>
            {ocultas && (
              <p className="text-xs text-muted-foreground">
                {nome} não é Premium: as notas de cada habilidade dele ficam escondidas.
              </p>
            )}
            <Button className="w-full" onClick={() => setAberto(false)}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function Linha({
  nome,
  meu,
  dele,
  ganho,
}: {
  nome: string;
  meu: number | null;
  dele: number | null;
  ganho: number;
}) {
  const classe = (lado: "meu" | "dele") =>
    cn(
      "w-12 rounded-lg py-1 text-center font-extrabold tabular-nums",
      (lado === "meu" ? ganho > 0 : ganho < 0) ? "bg-mint-soft text-primary" : "text-foreground",
    );
  return (
    <>
      <span className="truncate font-semibold text-foreground">{nome}</span>
      <span className={classe("meu")}>{meu ?? "…"}</span>
      <span className={cn(classe("dele"), dele == null && "blur-[4px] select-none")}>
        {dele ?? "??"}
      </span>
    </>
  );
}
