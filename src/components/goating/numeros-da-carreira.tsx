import { useState } from "react";
import { Goal, Hand, Lock, Sparkles, Trophy } from "lucide-react";
import { FolhaPremium } from "@/components/goating/cadeado";
import { useContador } from "@/hooks/use-contador";
import type { NumerosDoJogador } from "@/hooks/use-numeros-do-jogador";
import { cn } from "@/lib/utils";

/**
 * Números da carreira inteira, em destaque no perfil: todos os gols, assistências e defesas
 * que o jogador já fez no Goating, em todas as turmas. Premium: os números contam até o total.
 * Sem Premium, o painel aparece igual, com os números borrados e o convite.
 */
export function NumerosDaCarreira({
  numeros,
  liberado,
  proprio,
  nome,
}: {
  numeros: NumerosDoJogador | undefined;
  liberado: boolean;
  proprio: boolean;
  nome: string;
}) {
  const [convite, setConvite] = useState(false);
  const itens = [
    { rotulo: "Gols", valor: numeros?.gols ?? 0, icone: Goal },
    { rotulo: "Assistências", valor: numeros?.assistencias ?? 0, icone: Sparkles },
    { rotulo: "Defesas épicas", valor: numeros?.defesas ?? 0, icone: Hand },
  ];

  return (
    <section
      className="relative overflow-hidden rounded-3xl p-4 text-white shadow-[var(--shadow-card)]"
      style={{
        background:
          "radial-gradient(ellipse 70% 60% at 50% 0%, rgb(247 215 116 / 0.35), transparent 70%), linear-gradient(160deg, #0b2a20, #0f3d2e 55%, #08201a)",
      }}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.18em] text-tier-ouro uppercase">
        <Trophy className="size-3.5" />
        {proprio ? "Sua carreira no Goating" : `A carreira de ${nome}`}
      </p>
      <p className="mt-0.5 text-xs text-white/60">
        Tudo o que {proprio ? "você já fez" : "já fez"} em todas as peladas e turmas
      </p>

      <div className="relative mt-4">
        <div className={cn("grid grid-cols-3 gap-2", !liberado && "blur-[7px] select-none")}>
          {itens.map((i) => (
            <Numero key={i.rotulo} {...i} liberado={liberado} />
          ))}
        </div>
        {!liberado && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-black/40 ring-2 ring-tier-ouro">
              <Lock className="size-6 text-tier-ouro" />
            </span>
          </span>
        )}
      </div>

      {liberado && numeros && (
        <p className="mt-3 text-center text-xs font-semibold text-white/70">
          {numeros.jogos} {numeros.jogos === 1 ? "jogo" : "jogos"} · {numeros.vitorias}{" "}
          {numeros.vitorias === 1 ? "vitória" : "vitórias"}
        </p>
      )}

      {!liberado && (
        <button
          type="button"
          onClick={() => setConvite(true)}
          className="mt-3 flex w-full flex-col items-center gap-1 text-center"
        >
          <span className="text-base font-black text-white">
            {proprio ? "Todos os gols que você já fez" : `${nome} esconde os números`}
          </span>
          <span className="text-xs text-white/75">
            {proprio
              ? "Gols, assistências e defesas da sua carreira inteira"
              : "Os números da carreira aparecem pra quem é Premium"}
          </span>
          <span className="mt-1 rounded-full bg-tier-ouro px-4 py-1.5 text-xs font-extrabold text-[#3A2A05]">
            {proprio ? "Ver minha carreira" : "Mostrar a minha"}
          </span>
        </button>
      )}
      {convite && (
        <FolhaPremium recurso="Os números da carreira" onFechar={() => setConvite(false)} />
      )}
    </section>
  );
}

function Numero({
  rotulo,
  valor,
  icone: Icone,
  liberado,
}: {
  rotulo: string;
  valor: number;
  icone: typeof Goal;
  liberado: boolean;
}) {
  const contando = useContador(liberado ? valor : 0, 1400);
  return (
    <div className="rounded-2xl bg-white/[0.07] px-2 py-3 text-center ring-1 ring-tier-ouro/30">
      <Icone className="mx-auto size-4 text-tier-ouro" />
      <p className="mt-1 text-3xl leading-none font-black tabular-nums drop-shadow-[0_0_12px_rgb(247_215_116_/_0.5)]">
        {liberado ? Math.round(contando) : "??"}
      </p>
      <p className="mt-1 text-[10px] font-bold tracking-wide text-white/70 uppercase">{rotulo}</p>
    </div>
  );
}
