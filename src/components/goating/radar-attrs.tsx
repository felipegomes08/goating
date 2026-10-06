export type Eixo = { label: string; valor: number };

/** Folga de cada lado pros rótulos compridos ("VELOCIDADE") não saírem do desenho. */
const MARGEM_LATERAL = 46;

/** Teia de atributos estilo FIFA antigo (valores 0–100). */
export function RadarAttrs({ eixos, size = 260 }: { eixos: Eixo[]; size?: number }) {
  const largura = size + MARGEM_LATERAL * 2;
  const cx = largura / 2;
  const cy = size / 2;
  const raio = size / 2 - 34;
  const n = eixos.length;

  const angulo = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const ponto = (i: number, escala: number) =>
    [cx + Math.cos(angulo(i)) * raio * escala, cy + Math.sin(angulo(i)) * raio * escala] as const;

  const poligono = (escala: number) =>
    Array.from({ length: n }, (_, i) => ponto(i, escala).join(",")).join(" ");

  const forma = eixos.map((e, i) => ponto(i, Math.max(0.05, e.valor / 100)).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${largura} ${size}`} className="mx-auto w-full max-w-[360px]" role="img">
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon
          key={r}
          points={poligono(r)}
          fill="none"
          stroke="var(--mint)"
          strokeOpacity={0.18}
          strokeWidth={1}
        />
      ))}
      {eixos.map((_, i) => {
        const [x, y] = ponto(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--mint)"
            strokeOpacity={0.15}
            strokeWidth={1}
          />
        );
      })}
      <polygon
        points={forma}
        fill="var(--mint)"
        fillOpacity={0.25}
        stroke="var(--mint)"
        strokeWidth={2}
      />
      {eixos.map((e, i) => {
        const [px, py] = ponto(i, Math.max(0.05, e.valor / 100));
        // Rótulo dos lados cresce pra fora do gráfico; em cima e embaixo fica centrado.
        const lado = Math.cos(angulo(i));
        const ancora = lado > 0.3 ? "start" : lado < -0.3 ? "end" : "middle";
        const [lx, ly] = ponto(i, ancora === "middle" ? 1.2 : 1.1);
        return (
          <g key={e.label}>
            <circle cx={px} cy={py} r={3} fill="var(--mint)" />
            <text
              x={lx}
              y={ly}
              textAnchor={ancora}
              dominantBaseline="middle"
              fill="var(--mint)"
              fontSize={9}
              fontWeight={700}
            >
              {e.label.toUpperCase()}
            </text>
            <text
              x={lx}
              y={ly + 10}
              textAnchor={ancora}
              dominantBaseline="middle"
              fill="white"
              fontSize={10}
              fontWeight={800}
            >
              {e.valor}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
