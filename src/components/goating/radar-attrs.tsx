export type Eixo = { label: string; valor: number };

/** Teia de atributos estilo FIFA antigo (valores 0–100). */
export function RadarAttrs({ eixos, size = 260 }: { eixos: Eixo[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const raio = size / 2 - 34;
  const n = eixos.length;

  const ponto = (i: number, escala: number) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(ang) * raio * escala, cy + Math.sin(ang) * raio * escala] as const;
  };

  const poligono = (escala: number) =>
    Array.from({ length: n }, (_, i) => ponto(i, escala).join(",")).join(" ");

  const forma = eixos
    .map((e, i) => ponto(i, Math.max(0.05, e.valor / 100)).join(","))
    .join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[300px]" role="img">
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
        const [lx, ly] = ponto(i, 1.2);
        return (
          <g key={e.label}>
            <circle cx={px} cy={py} r={3} fill="var(--mint)" />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
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
              textAnchor="middle"
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
