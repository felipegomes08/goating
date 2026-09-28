import { useEffect, useRef, useState } from "react";

function prefereMenosMovimento() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Número que "conta" até o alvo (efeito de placar). Parte do valor anterior,
 * então quando o alvo muda ele anima só a diferença.
 */
export function useContador(alvo: number, duracaoMs = 900) {
  const [valor, setValor] = useState(0);
  const atual = useRef(0);

  useEffect(() => {
    if (prefereMenosMovimento()) {
      atual.current = alvo;
      setValor(alvo);
      return;
    }
    const de = atual.current;
    const inicio = performance.now();
    let frame = 0;
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracaoMs);
      const suave = 1 - Math.pow(1 - t, 3);
      atual.current = de + (alvo - de) * suave;
      setValor(atual.current);
      if (t < 1) frame = requestAnimationFrame(passo);
    };
    frame = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(frame);
  }, [alvo, duracaoMs]);

  return valor;
}
