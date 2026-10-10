/** Cartão do perfil: a cartinha do jogador num palco, com números e atributos, pra mandar no grupo. */

import type { MediasAtributos } from "@/lib/atributos";
import {
  APAGADO,
  BRANCO,
  LARGURA,
  MARGEM,
  MENTA,
  VERDE,
  type Ctx,
  carregarImagem,
  desenharLogo,
  escrever,
  fonte,
  paraArquivo,
  retanguloArredondado,
} from "@/lib/placar/poster";
import {
  TIERS,
  type CaixaCarta,
  type TierConfig,
  type TierNome,
  tierPorNome,
  tierSeguinte,
} from "@/lib/tiers";
import { hostDoSite } from "@/lib/site";

export type DadosDoCartao = {
  nome: string;
  nick: string | null;
  cidade: string | null;
  posicao: string | null;
  overall: number;
  tier: TierNome | null;
  /** já na escala 0–100 */
  atributos: MediasAtributos;
  peladas: number;
  mvps: number;
  xp: number;
  avaliacoes: number;
  /** endereço da foto já assinado (pode ser null) */
  fotoUrl: string | null;
  /**
   * Cartão de quem acabou de subir de tier: ganha a manchete no topo e a carta maior,
   * no lugar dos atributos. `de` é o tier anterior (null = era o primeiro).
   */
  conquista?: { de: TierNome | null } | undefined;
};

const ALTURA = 1920;

// Canvas não lê as variáveis de cor do tema: cor do texto na carta e cor do brilho, por tier.
const CORES: Record<TierNome, { texto: string; brilho: string }> = {
  Bronze: { texto: "#CB8B55", brilho: "#C0703A" },
  Prata: { texto: "#CDD2DA", brilho: "#9FB3CC" },
  Ouro: { texto: "#F2C94C", brilho: "#E9B530" },
  Platina: { texto: "#B8F0DC", brilho: "#5FD6B0" },
  Lendário: { texto: "#F6F5EE", brilho: "#F2CF6B" },
  GOAT: { texto: "#63A8F5", brilho: "#3B8BEA" },
};

const ATRIBUTOS: { chave: keyof MediasAtributos; nome: string; sigla: string }[] = [
  { chave: "chute", nome: "Chute", sigla: "CHU" },
  { chave: "drible", nome: "Drible", sigla: "DRI" },
  { chave: "velocidade", nome: "Velocidade", sigla: "VEL" },
  { chave: "toque", nome: "Toque", sigla: "TOQ" },
  { chave: "posicionamento", nome: "Posição", sigla: "POS" },
  { chave: "comportamento", nome: "Postura", sigla: "COM" },
  { chave: "pontualidade", nome: "Pontual", sigla: "PON" },
];

const milhar = (n: number) => n.toLocaleString("pt-BR");

/** "#RRGGBB" + opacidade -> rgba() */
function comAlfa(hex: string, alfa: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alfa})`;
}

/** Sorteio que dá sempre o mesmo resultado: as faíscas não mudam de lugar a cada prévia. */
function sorteador(semente: number) {
  let s = semente;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function faisca(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

/** Estádio à noite: holofotes vindo de cima e o brilho do tier atrás da carta. */
function palco(ctx: Ctx, brilho: string, centroY: number) {
  const base = ctx.createLinearGradient(0, 0, 0, ALTURA);
  base.addColorStop(0, "#04130D");
  base.addColorStop(0.45, VERDE);
  base.addColorStop(1, "#03100B");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  const aura = ctx.createRadialGradient(LARGURA / 2, centroY, 80, LARGURA / 2, centroY, 820);
  aura.addColorStop(0, comAlfa(brilho, 0.5));
  aura.addColorStop(0.45, comAlfa(brilho, 0.14));
  aura.addColorStop(1, comAlfa(brilho, 0));
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  // holofotes
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  [-0.34, -0.17, 0, 0.17, 0.34].forEach((inclinacao, i) => {
    ctx.save();
    ctx.translate(LARGURA / 2 + inclinacao * 900, -80);
    ctx.rotate(-inclinacao * 0.9);
    const feixe = ctx.createLinearGradient(0, 0, 0, 1250);
    feixe.addColorStop(0, comAlfa(i === 2 ? brilho : "#FFFFFF", i === 2 ? 0.2 : 0.09));
    feixe.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = feixe;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(14, 0);
    ctx.lineTo(170, 1250);
    ctx.lineTo(-170, 1250);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();

  // riscos diagonais, bem de leve, pra dar movimento
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.022)";
  ctx.lineWidth = 26;
  for (let x = -ALTURA; x < LARGURA; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, ALTURA);
    ctx.lineTo(x + ALTURA * 0.55, 0);
    ctx.stroke();
  }
  ctx.restore();

  const sorteio = sorteador(7);
  for (let i = 0; i < 46; i++) {
    const x = sorteio() * LARGURA;
    const y = 150 + sorteio() * 900;
    const r = 4 + sorteio() * 13;
    // longe do miolo, onde fica a carta
    if (Math.abs(x - LARGURA / 2) < 350) continue;
    ctx.fillStyle = comAlfa(i % 3 === 0 ? "#FFFFFF" : brilho, 0.25 + sorteio() * 0.55);
    faisca(ctx, x, y, r);
  }

  const sombra = ctx.createRadialGradient(
    LARGURA / 2,
    ALTURA / 2,
    600,
    LARGURA / 2,
    ALTURA / 2,
    1150,
  );
  sombra.addColorStop(0, "rgba(0,0,0,0)");
  sombra.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = sombra;
  ctx.fillRect(0, 0, LARGURA, ALTURA);
}

/** A cartinha, igual à do app: foto atrás, molde do tier por cima e os textos nas áreas do molde. */
async function carta(
  ctx: Ctx,
  dados: DadosDoCartao,
  visual: TierConfig,
  cores: { texto: string; brilho: string },
  x: number,
  y: number,
  w: number,
) {
  const h = (w * 1448) / 1086;
  const [molde, foto] = await Promise.all([
    carregarImagem(visual.molde),
    dados.fotoUrl ? carregarImagem(dados.fotoUrl) : Promise.resolve(null),
  ]);
  const area = (c: CaixaCarta, folga = 0) => ({
    x: x + ((c.x - folga) / 100) * w,
    y: y + ((c.y - folga) / 100) * h,
    w: ((c.w + folga * 2) / 100) * w,
    h: ((c.h + folga * 2) / 100) * h,
  });

  // chão: o reflexo da carta no gramado
  const chao = ctx.createRadialGradient(x + w / 2, y + h + 26, 10, x + w / 2, y + h + 26, w * 0.62);
  chao.addColorStop(0, comAlfa(cores.brilho, 0.55));
  chao.addColorStop(1, comAlfa(cores.brilho, 0));
  ctx.save();
  ctx.translate(0, y + h + 26);
  ctx.scale(1, 0.13);
  ctx.translate(0, -(y + h + 26));
  ctx.fillStyle = chao;
  ctx.fillRect(x - w * 0.3, y + h + 26 - w, w * 1.6, w * 2);
  ctx.restore();

  if (molde) {
    // primeira passada só pelo brilho em volta; a foto entra depois e o molde fecha por cima
    ctx.save();
    ctx.shadowColor = comAlfa(cores.brilho, 0.9);
    ctx.shadowBlur = 110;
    ctx.drawImage(molde, x, y, w, h);
    ctx.restore();
  }

  const escudo = area(visual.layout.escudo, 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(escudo.x, escudo.y, escudo.w, escudo.h);
  ctx.clip();
  const fundoDaFoto = ctx.createLinearGradient(0, escudo.y, 0, escudo.y + escudo.h);
  fundoDaFoto.addColorStop(0, "#1C6A4C");
  fundoDaFoto.addColorStop(1, VERDE);
  ctx.fillStyle = fundoDaFoto;
  ctx.fillRect(escudo.x, escudo.y, escudo.w, escudo.h);
  if (foto) {
    const escala = Math.max(escudo.w / foto.width, escudo.h / foto.height);
    const lw = foto.width * escala;
    // alinhada pelo topo, como na carta do app: o rosto fica na parte de cima da foto
    ctx.drawImage(foto, escudo.x + (escudo.w - lw) / 2, escudo.y, lw, foto.height * escala);
  } else {
    // sem foto: silhueta
    const cx = escudo.x + escudo.w / 2;
    ctx.fillStyle = comAlfa(MENTA, 0.35);
    ctx.beginPath();
    ctx.arc(cx, escudo.y + escudo.h * 0.36, escudo.w * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, escudo.y + escudo.h * 0.92, escudo.w * 0.38, escudo.h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (molde) ctx.drawImage(molde, x, y, w, h);
  else {
    ctx.strokeStyle = cores.texto;
    ctx.lineWidth = 6;
    retanguloArredondado(ctx, x, y, w, h, 40);
    ctx.stroke();
  }

  const hex = area(visual.layout.hex);
  escrever(
    ctx,
    dados.overall > 0 ? String(Math.round(dados.overall)) : "—",
    hex.x + hex.w / 2,
    hex.y + hex.h * 0.6,
    {
      peso: 900,
      tamanho: w * 0.105,
      cor: cores.texto,
      largura: hex.w * 0.8,
      alinhar: "center",
    },
  );
  escrever(ctx, dados.posicao ?? "—", hex.x + hex.w / 2, hex.y + hex.h * 0.83, {
    peso: 800,
    tamanho: w * 0.038,
    cor: cores.texto,
    largura: hex.w * 0.7,
    alinhar: "center",
  });

  const faixa = area(visual.layout.nome);
  const tamanhoNome = w * 0.052;
  escrever(
    ctx,
    dados.nome.toUpperCase(),
    faixa.x + faixa.w / 2,
    faixa.y + faixa.h / 2 + tamanhoNome * 0.36,
    {
      peso: 800,
      tamanho: tamanhoNome,
      cor: cores.texto,
      largura: faixa.w * 0.84,
      alinhar: "center",
      minimo: 18,
    },
  );

  const atrib = area(visual.layout.atrib);
  const coluna = (atrib.w * 0.94) / 5;
  ATRIBUTOS.slice(0, 5).forEach((a, i) => {
    const cx = atrib.x + atrib.w * 0.03 + coluna * (i + 0.5);
    escrever(ctx, String(dados.atributos[a.chave]), cx, atrib.y + atrib.h * 0.52, {
      peso: 900,
      tamanho: w * 0.066,
      cor: cores.texto,
      largura: coluna,
      alinhar: "center",
    });
    escrever(ctx, a.sigla, cx, atrib.y + atrib.h * 0.8, {
      peso: 600,
      tamanho: w * 0.031,
      cor: comAlfa(cores.texto, 0.8),
      largura: coluna,
      alinhar: "center",
      minimo: 12,
    });
  });

  return h;
}

/** Teia dos 7 atributos. */
function radar(
  ctx: Ctx,
  atributos: MediasAtributos,
  cx: number,
  cy: number,
  raio: number,
  cor: string,
) {
  const n = ATRIBUTOS.length;
  const angulo = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const ponto = (i: number, escala: number) =>
    [cx + Math.cos(angulo(i)) * raio * escala, cy + Math.sin(angulo(i)) * raio * escala] as const;
  const caminho = (escalas: number[]) => {
    ctx.beginPath();
    escalas.forEach((e, i) => {
      const [px, py] = ponto(i, e);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  };

  ctx.lineWidth = 2;
  [0.25, 0.5, 0.75, 1].forEach((r) => {
    caminho(Array.from({ length: n }, () => r));
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.stroke();
  });
  ATRIBUTOS.forEach((_, i) => {
    const [px, py] = ponto(i, 1);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.stroke();
  });

  const valores = ATRIBUTOS.map((a) => Math.max(0.05, atributos[a.chave] / 100));
  caminho(valores);
  const preenchimento = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio);
  preenchimento.addColorStop(0, comAlfa(cor, 0.15));
  preenchimento.addColorStop(1, comAlfa(cor, 0.55));
  ctx.fillStyle = preenchimento;
  ctx.fill();
  ctx.save();
  ctx.shadowColor = cor;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = cor;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  ATRIBUTOS.forEach((a, i) => {
    const [px, py] = ponto(i, valores[i]!);
    ctx.fillStyle = BRANCO;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
    const [lx, ly] = ponto(i, 1.2);
    escrever(ctx, a.sigla, lx, ly + 8, {
      peso: 800,
      tamanho: 20,
      cor: APAGADO,
      largura: 70,
      alinhar: "center",
    });
  });
}

export async function desenharCartao(dados: DadosDoCartao): Promise<HTMLCanvasElement> {
  await Promise.all(
    [600, 800, 900].map((peso) => document.fonts.load(fonte(peso, 40)).catch(() => undefined)),
  );

  const canvas = document.createElement("canvas");
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Esse navegador não desenha imagens.");
  ctx.textBaseline = "alphabetic";
  const util = LARGURA - MARGEM * 2;
  const meio = LARGURA / 2;

  const tier = tierPorNome(dados.tier);
  // sem tier ainda, a carta usa o visual do Bronze, como no app
  const visual = tier ?? TIERS[0]!;
  const cores = CORES[visual.nome];

  const conquista = dados.conquista;
  const larguraCarta = conquista ? 690 : 660;
  const topoCarta = conquista ? 392 : 168;

  palco(ctx, cores.brilho, topoCarta + 440);
  await desenharLogo(ctx);
  escrever(ctx, conquista ? "NOVO TIER DESBLOQUEADO" : "CARTA DO JOGADOR", LARGURA - MARGEM, 120, {
    peso: 600,
    tamanho: 26,
    cor: APAGADO,
    largura: 500,
    alinhar: "right",
  });

  if (conquista) {
    ctx.save();
    ctx.shadowColor = comAlfa(cores.brilho, 0.9);
    ctx.shadowBlur = 40;
    escrever(ctx, "SUBI DE NÍVEL", meio, 286, {
      peso: 900,
      tamanho: 112,
      cor: BRANCO,
      largura: util,
      alinhar: "center",
    });
    ctx.restore();
    // de onde veio e onde chegou; no primeiro tier não tem "de onde"
    const chegada = visual.nome.toUpperCase();
    const partida = conquista.de ? `${conquista.de.toUpperCase()}   ›   ` : "";
    ctx.font = fonte(800, 36);
    const larguraPartida = ctx.measureText(partida).width;
    const larguraTotal = larguraPartida + ctx.measureText(chegada).width;
    escrever(ctx, partida, meio - larguraTotal / 2, 348, {
      peso: 800,
      tamanho: 36,
      cor: APAGADO,
      largura: util,
    });
    escrever(ctx, chegada, meio - larguraTotal / 2 + larguraPartida, 348, {
      peso: 800,
      tamanho: 36,
      cor: cores.texto,
      largura: util,
    });
  }

  const alturaCarta = await carta(
    ctx,
    dados,
    visual,
    cores,
    meio - larguraCarta / 2,
    topoCarta,
    larguraCarta,
  );
  let y = topoCarta + alturaCarta + 78;

  // tier: selo + nome, com um filete de cada lado
  const selo = tier ? await carregarImagem(tier.icone) : null;
  const rotuloTier = (tier?.nome ?? "Em ascensão").toUpperCase();
  ctx.font = fonte(900, 46);
  const larguraRotulo = ctx.measureText(rotuloTier).width;
  const larguraSelo = selo ? 74 : 0;
  const inicio = meio - (larguraRotulo + larguraSelo) / 2;
  if (selo) ctx.drawImage(selo, inicio, y - 50, 62, 62);
  ctx.save();
  ctx.shadowColor = comAlfa(cores.brilho, 0.9);
  ctx.shadowBlur = 26;
  escrever(ctx, rotuloTier, inicio + larguraSelo, y, {
    peso: 900,
    tamanho: 46,
    cor: cores.texto,
    largura: util,
  });
  ctx.restore();
  [-1, 1].forEach((lado) => {
    const perto = meio + lado * ((larguraRotulo + larguraSelo) / 2 + 28);
    const longe = lado < 0 ? MARGEM : LARGURA - MARGEM;
    const filete = ctx.createLinearGradient(perto, 0, longe, 0);
    filete.addColorStop(0, comAlfa(cores.brilho, 0.9));
    filete.addColorStop(1, comAlfa(cores.brilho, 0));
    ctx.fillStyle = filete;
    ctx.fillRect(Math.min(perto, longe), y - 20, Math.abs(longe - perto), 3);
  });

  const identidade = [dados.nick ? `@${dados.nick}` : null, dados.cidade]
    .filter(Boolean)
    .join("  ·  ");
  if (identidade) {
    escrever(ctx, identidade, meio, y + 52, {
      peso: 600,
      tamanho: 28,
      cor: APAGADO,
      largura: util,
      alinhar: "center",
    });
  }
  y += 86;

  // números da carreira
  const numeros: [string, string, boolean][] = [
    ["PELADAS", milhar(dados.peladas), false],
    ["MVP", milhar(dados.mvps), true],
    ["XP", milhar(dados.xp), false],
    ["AVALIAÇÕES", milhar(dados.avaliacoes), false],
  ];
  const vao = 16;
  const larguraQuadro = (util - vao * 3) / 4;
  numeros.forEach(([rotulo, valor, destaque], i) => {
    const qx = MARGEM + i * (larguraQuadro + vao);
    ctx.fillStyle = destaque ? comAlfa(cores.brilho, 0.16) : "rgba(255,255,255,0.06)";
    retanguloArredondado(ctx, qx, y, larguraQuadro, 132, 24);
    ctx.fill();
    ctx.strokeStyle = destaque ? comAlfa(cores.brilho, 0.7) : "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();
    escrever(ctx, valor, qx + larguraQuadro / 2, y + 72, {
      peso: 900,
      tamanho: 54,
      cor: destaque ? cores.texto : BRANCO,
      largura: larguraQuadro - 28,
      alinhar: "center",
    });
    escrever(ctx, rotulo, qx + larguraQuadro / 2, y + 108, {
      peso: 600,
      tamanho: 20,
      cor: APAGADO,
      largura: larguraQuadro - 20,
      alinhar: "center",
      minimo: 14,
    });
  });
  y += 132 + 22;

  if (conquista) y += 30;
  else {
    // atributos: teia de um lado, barras do outro
    const alturaPainel = 340;
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    retanguloArredondado(ctx, MARGEM, y, util, alturaPainel, 30);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();
    radar(ctx, dados.atributos, MARGEM + 196, y + alturaPainel / 2 + 4, 112, cores.brilho);

    const melhor = Math.max(...ATRIBUTOS.map((a) => dados.atributos[a.chave]));
    const xRotulo = MARGEM + 410;
    const xBarra = xRotulo + 172;
    const xValor = LARGURA - MARGEM - 30;
    const larguraBarra = xValor - 76 - xBarra;
    ATRIBUTOS.forEach((a, i) => {
      const valor = dados.atributos[a.chave];
      const base = y + 62 + i * 40;
      const topo = valor === melhor && valor > 0;
      escrever(ctx, a.nome, xRotulo, base, {
        peso: 600,
        tamanho: 24,
        cor: topo ? BRANCO : APAGADO,
        largura: 164,
      });
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      retanguloArredondado(ctx, xBarra, base - 16, larguraBarra, 12, 6);
      ctx.fill();
      if (valor > 0) {
        const cheio = ctx.createLinearGradient(xBarra, 0, xBarra + larguraBarra, 0);
        cheio.addColorStop(0, comAlfa(topo ? cores.brilho : MENTA, 0.55));
        cheio.addColorStop(1, topo ? cores.brilho : MENTA);
        ctx.fillStyle = cheio;
        retanguloArredondado(
          ctx,
          xBarra,
          base - 16,
          Math.max(12, (larguraBarra * valor) / 100),
          12,
          6,
        );
        ctx.fill();
      }
      escrever(ctx, String(valor), xValor, base + 2, {
        peso: 900,
        tamanho: 30,
        cor: topo ? cores.texto : BRANCO,
        largura: 70,
        alinhar: "right",
      });
    });
    y += alturaPainel + 48;
  }

  // quanto falta pro próximo tier
  const seguinte = tierSeguinte(tier);
  if (seguinte) {
    const corSeguinte = CORES[seguinte.nome];
    escrever(ctx, `RUMO AO ${seguinte.nome.toUpperCase()}`, MARGEM, y, {
      peso: 900,
      tamanho: 28,
      cor: corSeguinte.texto,
      largura: util / 2,
    });
    escrever(ctx, `${milhar(dados.xp)} / ${milhar(seguinte.xpMinimo)} XP`, LARGURA - MARGEM, y, {
      peso: 600,
      tamanho: 26,
      cor: APAGADO,
      largura: util / 2,
      alinhar: "right",
    });
    const progresso = Math.min(1, dados.xp / seguinte.xpMinimo);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    retanguloArredondado(ctx, MARGEM, y + 22, util, 20, 10);
    ctx.fill();
    const cheio = ctx.createLinearGradient(MARGEM, 0, MARGEM + util, 0);
    cheio.addColorStop(0, cores.brilho);
    cheio.addColorStop(1, corSeguinte.brilho);
    ctx.save();
    ctx.shadowColor = comAlfa(corSeguinte.brilho, 0.9);
    ctx.shadowBlur = 20;
    ctx.fillStyle = cheio;
    retanguloArredondado(ctx, MARGEM, y + 22, Math.max(20, util * progresso), 20, 10);
    ctx.fill();
    ctx.restore();
  } else {
    escrever(ctx, "O MAIOR DE TODOS OS TEMPOS", meio, y + 26, {
      peso: 900,
      tamanho: 34,
      cor: cores.texto,
      largura: util,
      alinhar: "center",
    });
  }

  escrever(ctx, hostDoSite(), meio, ALTURA - 56, {
    peso: 600,
    tamanho: 26,
    cor: APAGADO,
    largura: util,
    alinhar: "center",
  });

  return canvas;
}

/** Cartão do perfil já como arquivo de imagem (pra pré-visualizar e depois compartilhar). */
export const gerarCartao = async (dados: DadosDoCartao) => paraArquivo(await desenharCartao(dados));
