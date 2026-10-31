/** Cartão do fim da liga: o campeão em destaque, o pódio e os premiados de cada categoria. */

import {
  APAGADO,
  BRANCO,
  LARGURA,
  MARGEM,
  MENTA,
  OURO,
  VERDE,
  VERDE_CLARO,
  desenharLogo,
  escrever,
  fonte,
  paraArquivo,
  retanguloArredondado,
} from "@/lib/placar/poster";
import { hostDoSite } from "@/lib/site";

export type DadosDoCartaoDaLiga = {
  liga: string;
  turma: string | null;
  /** "1 de nov. a 31 de dez." */
  periodo: string;
  /** campeões (empate = mais de um), com os pontos */
  campeoes: { nome: string; pontos: number }[];
  /** 2º e 3º da tabela */
  podio: { posicao: number; nome: string; pontos: number }[];
  /** "Artilheiro" → "Felipe · 18 gols" */
  premios: { rotulo: string; texto: string }[];
};

export async function desenharCartaoDaLiga(dados: DadosDoCartaoDaLiga) {
  await Promise.all(
    [600, 800, 900].map((peso) => document.fonts.load(fonte(peso, 40)).catch(() => undefined)),
  );
  // a altura acompanha o pódio e as fileiras de prêmios (o endereço do site fica embaixo)
  const fileiras = Math.ceil(Math.min(dados.premios.length, 6) / 2);
  const topoDosPremios = 880 + 94 * Math.min(dados.podio.length, 2) + 30;
  const ALTURA = Math.max(1350, topoDosPremios + fileiras * 120 + 110);
  const canvas = document.createElement("canvas");
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Esse navegador não desenha imagens.");
  const util = LARGURA - MARGEM * 2;
  ctx.textBaseline = "alphabetic";

  // fundo verde com luz dourada atrás do campeão
  ctx.fillStyle = VERDE;
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  const luz = ctx.createRadialGradient(LARGURA / 2, 470, 40, LARGURA / 2, 470, 760);
  luz.addColorStop(0, "rgba(233,188,75,0.38)");
  luz.addColorStop(0.5, VERDE_CLARO);
  luz.addColorStop(1, "rgba(15,61,46,0)");
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  await desenharLogo(ctx);
  escrever(ctx, "FIM DE LIGA", LARGURA - MARGEM, 120, {
    peso: 700,
    tamanho: 26,
    cor: APAGADO,
    largura: 400,
    alinhar: "right",
  });

  escrever(ctx, dados.liga, LARGURA / 2, 250, {
    peso: 900,
    tamanho: 64,
    cor: BRANCO,
    largura: util,
    alinhar: "center",
  });
  escrever(ctx, [dados.turma, dados.periodo].filter(Boolean).join(" · "), LARGURA / 2, 300, {
    peso: 600,
    tamanho: 30,
    cor: MENTA,
    largura: util,
    alinhar: "center",
  });

  // troféu desenhado
  const cx = LARGURA / 2;
  ctx.fillStyle = OURO;
  ctx.beginPath();
  ctx.moveTo(cx - 90, 360);
  ctx.lineTo(cx + 90, 360);
  ctx.quadraticCurveTo(cx + 85, 500, cx, 520);
  ctx.quadraticCurveTo(cx - 85, 500, cx - 90, 360);
  ctx.fill();
  ctx.lineWidth = 16;
  ctx.strokeStyle = OURO;
  ctx.beginPath();
  ctx.arc(cx - 95, 420, 40, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 95, 420, 40, Math.PI * 1.5, Math.PI * 0.5);
  ctx.stroke();
  ctx.fillRect(cx - 16, 515, 32, 50);
  retanguloArredondado(ctx, cx - 80, 560, 160, 34, 10);
  ctx.fill();

  escrever(ctx, dados.campeoes.length > 1 ? "CAMPEÕES" : "CAMPEÃO", cx, 660, {
    peso: 800,
    tamanho: 30,
    cor: OURO,
    largura: util,
    alinhar: "center",
  });
  const nomes = dados.campeoes.map((c) => c.nome).join(" e ") || "Ninguém pontuou";
  escrever(ctx, nomes, cx, 745, {
    peso: 900,
    tamanho: 76,
    cor: BRANCO,
    largura: util,
    alinhar: "center",
    minimo: 40,
  });
  if (dados.campeoes[0]) {
    escrever(ctx, `${dados.campeoes[0].pontos} pontos`, cx, 800, {
      peso: 700,
      tamanho: 34,
      cor: MENTA,
      largura: util,
      alinhar: "center",
    });
  }

  // 2º e 3º
  let y = 880;
  for (const p of dados.podio.slice(0, 2)) {
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    retanguloArredondado(ctx, MARGEM, y, util, 78, 20);
    ctx.fill();
    escrever(ctx, `${p.posicao}º`, MARGEM + 30, y + 52, {
      peso: 900,
      tamanho: 36,
      cor: APAGADO,
      largura: 80,
    });
    escrever(ctx, p.nome, MARGEM + 120, y + 52, {
      peso: 700,
      tamanho: 36,
      cor: BRANCO,
      largura: util - 320,
    });
    escrever(ctx, `${p.pontos} pts`, LARGURA - MARGEM - 30, y + 52, {
      peso: 800,
      tamanho: 34,
      cor: MENTA,
      largura: 200,
      alinhar: "right",
    });
    y += 94;
  }

  // premiados das categorias, em duas colunas
  y += 30;
  const coluna = (util - 24) / 2;
  dados.premios.slice(0, 6).forEach((p, i) => {
    const x = MARGEM + (i % 2) * (coluna + 24);
    const topo = y + Math.floor(i / 2) * 120;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    retanguloArredondado(ctx, x, topo, coluna, 104, 20);
    ctx.fill();
    escrever(ctx, p.rotulo.toUpperCase(), x + 24, topo + 40, {
      peso: 800,
      tamanho: 22,
      cor: OURO,
      largura: coluna - 48,
    });
    escrever(ctx, p.texto, x + 24, topo + 82, {
      peso: 700,
      tamanho: 30,
      cor: BRANCO,
      largura: coluna - 48,
      minimo: 22,
    });
  });

  escrever(ctx, hostDoSite(), LARGURA / 2, ALTURA - 60, {
    peso: 600,
    tamanho: 26,
    cor: APAGADO,
    largura: util,
    alinhar: "center",
  });
  return canvas;
}

export const gerarCartaoDaLiga = async (dados: DadosDoCartaoDaLiga) =>
  paraArquivo(await desenharCartaoDaLiga(dados));
