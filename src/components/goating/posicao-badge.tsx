import { cn } from "@/lib/utils";

/**
 * Onde fica o jogador num campinho de 12×16 (o ataque é pra cima). O lateral leva dois
 * pontos, um em cada lado, pra não confundir com o zagueiro.
 */
const POSICOES: Record<string, { nome: string; pontos: [number, number][] }> = {
  GOL: { nome: "Goleiro", pontos: [[6, 13.6]] },
  ZAG: { nome: "Zagueiro", pontos: [[6, 11.2]] },
  LAT: {
    nome: "Lateral",
    pontos: [
      [2.4, 10.4],
      [9.6, 10.4],
    ],
  },
  VOL: { nome: "Volante", pontos: [[6, 9.4]] },
  MEI: { nome: "Meia", pontos: [[6, 6.2]] },
  ATA: { nome: "Atacante", pontos: [[6, 2.6]] },
};

/**
 * Selo da posição do jogador: um campinho com o ponto onde ele joga, mais a sigla.
 * Sem posição informada, não renderiza nada.
 */
export function PosicaoBadge({
  posicao,
  className,
}: {
  posicao: string | null | undefined;
  className?: string;
}) {
  if (!posicao) return null;
  const info = POSICOES[posicao];

  return (
    <span
      title={info?.nome}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md bg-primary py-0.5 pr-1.5 pl-1 text-[10px] leading-none font-black tracking-wide text-primary-foreground",
        className,
      )}
    >
      {info && (
        <svg viewBox="0 0 12 16" className="h-3.5 w-[10.5px]" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5">
            <rect x="0.5" y="0.5" width="11" height="15" rx="1.5" />
            <path d="M0.5 8h11M3.5 0.5V3h5V0.5M3.5 15.5V13h5v2.5" />
          </g>
          {info.pontos.map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.7" fill="var(--mint)" />
          ))}
        </svg>
      )}
      {posicao}
      {info && <span className="sr-only"> ({info.nome})</span>}
    </span>
  );
}
