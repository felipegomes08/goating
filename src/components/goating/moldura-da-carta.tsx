import type { CSSProperties } from "react";
import { CAIXA_DA_ARTE, type Moldura } from "@/lib/molduras";

const variaveis = (moldura: Moldura) =>
  ({
    "--moldura-brilho": moldura.brilho,
    "--moldura-cores": moldura.cores.join(", "),
  }) as CSSProperties;

/**
 * Moldura Premium, camada de trás, atrás da carta e dentro da inclinação 3D (acompanha a carta):
 * - de arte: a imagem do efeito (fogo, raios, cristais...) saindo da silhueta, animada;
 * - de código: a silhueta do molde um pouco maior, pintada com o degradê animado e com brilho.
 */
export function MolduraDaCarta({ moldura, molde }: { moldura: Moldura; molde: string }) {
  if (moldura.arte) {
    return (
      <img
        src={moldura.arte}
        alt=""
        aria-hidden
        draggable={false}
        className={`moldura-arte moldura-arte-${moldura.animacao ?? "parada"}`}
        style={{
          left: `${CAIXA_DA_ARTE.esquerda * 100}%`,
          top: `${CAIXA_DA_ARTE.topo * 100}%`,
          width: `${CAIXA_DA_ARTE.largura * 100}%`,
          height: `${CAIXA_DA_ARTE.altura * 100}%`,
        }}
      />
    );
  }
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
