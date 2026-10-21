import { useState } from "react";
import { Lock } from "lucide-react";
import { RadarAttrs } from "@/components/goating/radar-attrs";
import { FolhaPremium } from "@/components/goating/cadeado";
import type { AtributoExibido } from "@/lib/atributos";

/**
 * O gráfico de teia do perfil. As notas de cada habilidade só aparecem quando o dono do perfil
 * é Premium; sem isso, a teia fica borrada com o convite (no próprio perfil) ou o aviso de que
 * o jogador não mostra as notas (no perfil de outra pessoa).
 */
export function AtributosDoJogador({
  atributos,
  ocultas,
  proprio,
  nome,
}: {
  atributos: AtributoExibido[];
  ocultas: boolean;
  proprio: boolean;
  nome: string;
}) {
  const [convite, setConvite] = useState(false);
  // borrado com uma forma qualquer: as notas de verdade nem chegam do banco
  const eixos = atributos.map((a, i) => ({
    label: a.radar,
    valor: ocultas ? 55 + ((i * 17) % 35) : a.valor,
  }));

  return (
    <section className="relative overflow-hidden rounded-2xl bg-primary p-4">
      <h2 className="mb-2 text-sm font-bold text-primary-foreground">Atributos</h2>
      <div className={ocultas ? "pointer-events-none blur-[6px] select-none" : undefined}>
        <RadarAttrs eixos={eixos} />
      </div>
      {ocultas && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          {proprio ? (
            <button
              type="button"
              onClick={() => setConvite(true)}
              className="flex flex-col items-center gap-1 rounded-2xl bg-card/95 px-5 py-4 text-center shadow-lg"
            >
              <Lock className="size-5 text-tier-ouro" />
              <span className="text-sm font-extrabold text-foreground">
                Veja suas notas de cada habilidade
              </span>
              <span className="text-xs text-muted-foreground">
                Com o Premium elas aparecem pra você e pra quem visitar seu perfil
              </span>
            </button>
          ) : (
            <p className="flex flex-col items-center gap-1 rounded-2xl bg-card/95 px-5 py-4 text-center shadow-lg">
              <Lock className="size-5 text-tier-ouro" />
              <span className="text-sm font-extrabold text-foreground">
                {nome} ainda não mostra as notas
              </span>
              <span className="text-xs text-muted-foreground">
                As notas de cada habilidade aparecem pra quem é Premium
              </span>
            </p>
          )}
        </div>
      )}
      {convite && <FolhaPremium recurso="Ver suas notas" onFechar={() => setConvite(false)} />}
    </section>
  );
}
