import type { CSSProperties } from "react";
import type { Moldura } from "@/lib/molduras";

const variaveis = (moldura: Moldura) =>
  ({
    "--moldura-brilho": moldura.brilho,
    "--moldura-cores": moldura.cores.join(", "),
  }) as CSSProperties;

/**
 * Moldura Premium, camada de trás: a silhueta do molde um pouco maior, atrás da carta,
 * pintada com o degradê animado da moldura e com brilho em volta. Fica dentro da inclinação
 * 3D, então acompanha a carta.
 */
export function MolduraDaCarta({ moldura, molde }: { moldura: Moldura; molde: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" style={variaveis(moldura)}>
      {/* o brilho fica no pai: a máscara cortaria o drop-shadow se estivesse no mesmo elemento */}
      <div className="moldura-brilho absolute inset-0">
        <div
          className={`moldura-borda moldura-${moldura.id} absolute inset-0`}
          style={{ maskImage: `url(${molde})`, WebkitMaskImage: `url(${molde})` }}
        />
      </div>
    </div>
  );
}

/** Moldura Premium, camada da frente: partículas subindo pelas bordas e os refletores. */
export function EfeitosDaMoldura({ moldura }: { moldura: Moldura }) {
  if (!moldura.particula) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" style={variaveis(moldura)}>
      {moldura.particula === "luz" ? (
        <>
          <span className="moldura-refletor" style={{ left: "8%" }} />
          <span className="moldura-refletor moldura-refletor-direita" style={{ right: "8%" }} />
        </>
      ) : (
        Array.from({ length: 12 }, (_, i) => {
          const tamanho = 3 + ((i * 5) % 4);
          // espalhadas pelas bordas: metade de cada lado, alturas fixas por índice
          const lado = i % 2 === 0 ? "left" : "right";
          return (
            <span
              key={i}
              className={`moldura-particula moldura-particula-${moldura.particula}`}
              style={{
                [lado]: `${-4 + ((i * 7) % 9)}%`,
                bottom: `${(i * 17) % 85}%`,
                width: tamanho,
                height: tamanho,
                animationDuration: `${2.5 + ((i * 3) % 4) * 0.6}s`,
                animationDelay: `-${(i * 0.45) % 3}s`,
              }}
            />
          );
        })
      )}
    </div>
  );
}
