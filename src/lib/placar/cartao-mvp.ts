/** Cartão do MVP da pelada: anúncio no estilo "reforço contratado", com a foto do jogador e os números dele no dia. */

import { CORES, comAlfa, faisca, sorteador } from "@/lib/placar/cartao-perfil";
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
import { TIERS, type TierNome, tierPorNome } from "@/lib/tiers";
import { hostDoSite } from "@/lib/site";
import { molduraPorId, type MolduraId } from "@/lib/molduras";

export type DadosDoMvp = {
  nome: string;
  nick: string | null;
  posicao: string | null;
  overall: number;
  tier: TierNome | null;
  /** endereço da foto já assinado (pode ser null) */
  fotoUrl: string | null;
  /** números dele no placar do dia; null quando a pelada não teve placar */
  gols: number | null;
  jogos: number | null;
  vitorias: number | null;
  /** assistências e defesas épicas dele na pelada (0 = não entra no cartão) */
  assistencias?: number | undefined;
  defesas?: number | undefined;
  /** média das notas que recebeu nessa pelada (0 a 10) */
  nota: number | null;
  avaliacoes: number;
  /** quantas vezes já foi MVP, contando esta */
  mvps: number;
  pelada: string;
  /** dia da pelada, "aaaa-mm-dd" */
  data: string;
  turma: string | null;
  /** MVP Premium: o cartão ganha a moldura dele e o selo dos MVPs marcantes (5º, 10º, 20º...) */
  premium?: boolean | undefined;
  moldura?: MolduraId | null | undefined;
};

/** MVPs que viram cartão especial (só pra quem é Premium). */
export const MVPS_MARCANTES = [5, 10, 20, 50, 100];

/** Moldura Premium em volta do cartão inteiro, com brilho na cor dela. */
function molduraDoCartao(ctx: Ctx, id: MolduraId) {
  const moldura = molduraPorId(id);
  if (!moldura) return;
  const degrade = ctx.createLinearGradient(0, 0, LARGURA, ALTURA);
  moldura.cores.forEach((cor, i) => degrade.addColorStop(i / (moldura.cores.length - 1), cor));
  ctx.save();
  ctx.strokeStyle = degrade;
  ctx.shadowColor = comAlfa(moldura.brilho, 0.9);
  ctx.shadowBlur = 40;
  ctx.lineWidth = 18;
  retanguloArredondado(ctx, 22, 22, LARGURA - 44, ALTURA - 44, 48);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.shadowBlur = 0;
  ctx.strokeStyle = comAlfa("#FFFFFF", 0.6);
  retanguloArredondado(ctx, 40, 40, LARGURA - 80, ALTURA - 80, 34);
  ctx.stroke();
  ctx.restore();
}

/** Medalhão dourado do MVP marcante ("10º MVP"), no canto de cima. */
function medalhao(ctx: Ctx, mvps: number) {
  const x = LARGURA - MARGEM - 110;
  const y = 300;
  const raio = 104;
  ctx.save();
  ctx.shadowColor = comAlfa("#F7D774", 0.9);
  ctx.shadowBlur = 50;
  const ouro = ctx.createLinearGradient(x - raio, y - raio, x + raio, y + raio);
  ouro.addColorStop(0, "#FFF3B0");
  ouro.addColorStop(0.5, "#E9B93A");
  ouro.addColorStop(1, "#8A6A12");
  ctx.fillStyle = ouro;
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#FFF3B0";
  ctx.beginPath();
  ctx.arc(x, y, raio - 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  escrever(ctx, `${mvps}º`, x, y + 22, {
    peso: 900,
    tamanho: 84,
    cor: "#3A2A05",
    largura: raio * 1.5,
    alinhar: "center",
  });
  escrever(ctx, "MVP", x, y + 62, {
    peso: 900,
    tamanho: 30,
    cor: "#3A2A05",
    largura: raio * 1.2,
    alinhar: "center",
  });
}

const ALTURA = 1920;
/** até onde vai a foto */
const ALTURA_DA_FOTO = 1160;
const ESCURO = "#03100B";
/** inclinação da faixa da manchete */
const INCLINACAO = -0.055;

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return (
    (partes[0]?.[0] ?? "") + (partes.length > 1 ? (partes.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}

/** Nome comprido não cabe em letra grande: fica o primeiro e o último. */
function nomeCurto(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return partes.length > 2 ? `${partes[0]} ${partes.at(-1)}` : nome.trim();
}

/** A foto do jogador ocupando o topo inteiro, tingida na cor do tier e sumindo no escuro embaixo. */
function retrato(ctx: Ctx, foto: ImageBitmap | null, nome: string, brilho: string) {
  const base = ctx.createLinearGradient(0, 0, 0, ALTURA);
  base.addColorStop(0, "#04130D");
  base.addColorStop(0.5, VERDE);
  base.addColorStop(1, ESCURO);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  if (foto) {
    const escala = Math.max(LARGURA / foto.width, ALTURA_DA_FOTO / foto.height);
    const lw = foto.width * escala;
    const lh = foto.height * escala;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, LARGURA, ALTURA_DA_FOTO);
    ctx.clip();
    // mais perto do topo: é onde fica o rosto
    ctx.drawImage(foto, (LARGURA - lw) / 2, (ALTURA_DA_FOTO - lh) * 0.25, lw, lh);
    // banho de cor do tier, pra foto de qualquer celular combinar com o cartão
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = comAlfa(brilho, 0.55);
    ctx.fillRect(0, 0, LARGURA, ALTURA_DA_FOTO);
    ctx.restore();
  } else {
    // sem foto: as iniciais gigantes dentro de um clarão
    const aura = ctx.createRadialGradient(LARGURA / 2, 560, 40, LARGURA / 2, 560, 620);
    aura.addColorStop(0, comAlfa(brilho, 0.55));
    aura.addColorStop(0.5, comAlfa(brilho, 0.14));
    aura.addColorStop(1, comAlfa(brilho, 0));
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, LARGURA, ALTURA_DA_FOTO);
    ctx.save();
    ctx.shadowColor = comAlfa(brilho, 0.9);
    ctx.shadowBlur = 60;
    escrever(ctx, iniciais(nome), LARGURA / 2, 720, {
      peso: 900,
      tamanho: 460,
      cor: comAlfa(BRANCO, 0.92),
      largura: LARGURA - MARGEM * 2,
      alinhar: "center",
    });
    ctx.restore();
  }

  // escurece em cima (pro logo) e embaixo (pra faixa e o nome lerem bem)
  const topo = ctx.createLinearGradient(0, 0, 0, 320);
  topo.addColorStop(0, "rgba(3,16,11,0.85)");
  topo.addColorStop(1, "rgba(3,16,11,0)");
  ctx.fillStyle = topo;
  ctx.fillRect(0, 0, LARGURA, 320);
  const pe = ctx.createLinearGradient(0, ALTURA_DA_FOTO * 0.5, 0, ALTURA_DA_FOTO);
  pe.addColorStop(0, "rgba(3,16,11,0)");
  pe.addColorStop(0.75, "rgba(3,16,11,0.82)");
  pe.addColorStop(1, ESCURO);
  ctx.fillStyle = pe;
  ctx.fillRect(0, ALTURA_DA_FOTO * 0.5, LARGURA, ALTURA_DA_FOTO * 0.5 + 2);
  ctx.fillStyle = ESCURO;
  ctx.fillRect(0, ALTURA_DA_FOTO, LARGURA, ALTURA - ALTURA_DA_FOTO);
}

/** Holofotes cruzando a foto, riscos de velocidade e faíscas nas bordas. */
function efeitos(ctx: Ctx, brilho: string) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  [-0.42, -0.2, 0.2, 0.42].forEach((inclinacao, i) => {
    ctx.save();
    ctx.translate(LARGURA / 2 + inclinacao * 1100, -90);
    ctx.rotate(-inclinacao * 0.95);
    const feixe = ctx.createLinearGradient(0, 0, 0, 1300);
    feixe.addColorStop(0, comAlfa(i % 2 ? "#FFFFFF" : brilho, 0.2));
    feixe.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = feixe;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.lineTo(150, 1300);
    ctx.lineTo(-150, 1300);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = comAlfa(brilho, 0.07);
  ctx.lineWidth = 22;
  for (let x = -ALTURA; x < LARGURA; x += 150) {
    ctx.beginPath();
    ctx.moveTo(x, ALTURA);
    ctx.lineTo(x + ALTURA * 0.5, 0);
    ctx.stroke();
  }
  ctx.restore();

  const sorteio = sorteador(23);
  for (let i = 0; i < 60; i++) {
    const x = sorteio() * LARGURA;
    const y = 190 + sorteio() * 860;
    const r = 4 + sorteio() * 15;
    // o miolo é do rosto
    if (Math.abs(x - LARGURA / 2) < 300) continue;
    ctx.fillStyle = comAlfa(i % 3 === 0 ? "#FFFFFF" : brilho, 0.3 + sorteio() * 0.6);
    faisca(ctx, x, y, r);
  }
}

/** "MVP" vazado gigante atrás, e a faixa inclinada na cor do tier com a manchete. */
function manchete(ctx: Ctx, brilho: string) {
  const centroY = 1010;
  ctx.save();
  ctx.translate(LARGURA / 2, centroY);
  ctx.rotate(INCLINACAO);

  ctx.font = fonte(900, 380);
  ctx.textAlign = "center";
  ctx.lineWidth = 5;
  ctx.strokeStyle = comAlfa(brilho, 0.38);
  ctx.strokeText("MVP", 0, -70);

  // sombra da faixa, deslocada, na cor clara
  ctx.fillStyle = comAlfa(BRANCO, 0.16);
  ctx.fillRect(-LARGURA, 18, LARGURA * 2, 124);
  const faixa = ctx.createLinearGradient(-LARGURA / 2, 0, LARGURA / 2, 0);
  faixa.addColorStop(0, brilho);
  faixa.addColorStop(0.5, "#FFFFFF");
  faixa.addColorStop(1, brilho);
  ctx.save();
  ctx.shadowColor = comAlfa(brilho, 0.9);
  ctx.shadowBlur = 50;
  ctx.fillStyle = brilho;
  ctx.fillRect(-LARGURA, 0, LARGURA * 2, 124);
  ctx.restore();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = faixa;
  ctx.fillRect(-LARGURA, 0, LARGURA * 2, 124);
  ctx.globalAlpha = 1;
  escrever(ctx, "MVP DA PARTIDA", 0, 91, {
    peso: 900,
    tamanho: 84,
    cor: "#04130D",
    largura: LARGURA - MARGEM * 2,
    alinhar: "center",
  });
  ctx.restore();
}

export async function desenharCartaoMvp(dados: DadosDoMvp): Promise<HTMLCanvasElement> {
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
  // sem tier ainda, usa as cores do Bronze, como na cartinha
  const cores = CORES[(tier ?? TIERS[0]!).nome];
  const [foto, selo] = await Promise.all([
    dados.fotoUrl ? carregarImagem(dados.fotoUrl) : Promise.resolve(null),
    tier ? carregarImagem(tier.icone) : Promise.resolve(null),
  ]);

  retrato(ctx, foto, dados.nome, cores.brilho);
  efeitos(ctx, cores.brilho);
  await desenharLogo(ctx);
  const dia = new Date(`${dados.data}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  escrever(ctx, dia.toUpperCase(), LARGURA - MARGEM, 120, {
    peso: 600,
    tamanho: 26,
    cor: APAGADO,
    largura: 500,
    alinhar: "right",
  });
  manchete(ctx, cores.brilho);

  // nome
  ctx.save();
  ctx.shadowColor = comAlfa(cores.brilho, 0.85);
  ctx.shadowBlur = 36;
  escrever(ctx, nomeCurto(dados.nome).toUpperCase(), meio, 1290, {
    peso: 900,
    tamanho: 132,
    cor: BRANCO,
    largura: util,
    alinhar: "center",
    minimo: 56,
  });
  ctx.restore();

  // tier (com o selo), posição e nick
  const identidade = [
    (tier?.nome ?? "Em ascensão").toUpperCase(),
    dados.posicao,
    dados.nick ? `@${dados.nick}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  ctx.font = fonte(800, 34);
  const larguraSelo = selo ? 60 : 0;
  const larguraIdentidade = Math.min(ctx.measureText(identidade).width, util - larguraSelo);
  const inicio = meio - (larguraIdentidade + larguraSelo) / 2;
  if (selo) ctx.drawImage(selo, inicio, 1318, 48, 48);
  escrever(ctx, identidade, inicio + larguraSelo, 1355, {
    peso: 800,
    tamanho: 34,
    cor: cores.texto,
    largura: util - larguraSelo,
  });

  // números: em cima os da pelada (grandes), embaixo os da carreira
  // cabem quatro quadros: a ordem de quem entra é nota, gols, defesas, assistências, vitórias
  const candidatos: { peso: number; ordem: number; item: [string, string] }[] = [];
  if (dados.gols !== null) {
    candidatos.push({
      peso: 2,
      ordem: 1,
      item: [dados.gols === 1 ? "GOL" : "GOLS", String(dados.gols)],
    });
  }
  if (dados.assistencias) {
    candidatos.push({
      peso: 4,
      ordem: 2,
      item: [dados.assistencias === 1 ? "ASSISTÊNCIA" : "ASSISTÊNCIAS", String(dados.assistencias)],
    });
  }
  if (dados.defesas) {
    candidatos.push({
      peso: 3,
      ordem: 3,
      item: [dados.defesas === 1 ? "DEFESA ÉPICA" : "DEFESAS ÉPICAS", String(dados.defesas)],
    });
  }
  if (dados.nota !== null) {
    candidatos.push({
      peso: 1,
      ordem: 4,
      item: ["NOTA DA PARTIDA", dados.nota.toFixed(1).replace(".", ",")],
    });
  }
  if (dados.vitorias !== null && dados.jogos) {
    candidatos.push({
      peso: 5,
      ordem: 5,
      item: [
        dados.jogos === 1 ? "VITÓRIA EM 1 JOGO" : `VITÓRIAS EM ${dados.jogos} JOGOS`,
        String(dados.vitorias),
      ],
    });
  }
  const daPelada = candidatos
    .sort((a, b) => a.peso - b.peso)
    .slice(0, 4)
    .sort((a, b) => a.ordem - b.ordem)
    .map((c) => c.item);
  const daCarreira: [string, string][] = [
    ["OVERALL", dados.overall > 0 ? String(Math.round(dados.overall)) : "—"],
    [dados.mvps === 1 ? "VEZ MVP" : "VEZES MVP", `${Math.max(1, dados.mvps)}x`],
    [dados.avaliacoes === 1 ? "NOTA RECEBIDA" : "NOTAS RECEBIDAS", String(dados.avaliacoes)],
  ];

  const vao = 18;
  const linha = (
    itens: [string, string][],
    y: number,
    altura: number,
    tamanho: number,
    destaque: boolean,
  ) => {
    if (itens.length === 0) return;
    const largura = (util - vao * (itens.length - 1)) / itens.length;
    itens.forEach(([rotulo, valor], i) => {
      const x = MARGEM + i * (largura + vao);
      ctx.fillStyle = destaque ? comAlfa(cores.brilho, 0.16) : "rgba(255,255,255,0.06)";
      retanguloArredondado(ctx, x, y, largura, altura, 28);
      ctx.fill();
      ctx.strokeStyle = destaque ? comAlfa(cores.brilho, 0.75) : "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      ctx.stroke();
      escrever(ctx, valor, x + largura / 2, y + altura * 0.58, {
        peso: 900,
        tamanho,
        cor: destaque ? cores.texto : BRANCO,
        largura: largura - 30,
        alinhar: "center",
      });
      escrever(ctx, rotulo, x + largura / 2, y + altura - 26, {
        peso: 600,
        tamanho: 22,
        cor: APAGADO,
        largura: largura - 24,
        alinhar: "center",
        minimo: 14,
      });
    });
  };
  linha(daPelada, 1404, 176, daPelada.length > 3 ? 78 : 92, true);
  linha(daCarreira, daPelada.length ? 1598 : 1480, 132, 54, false);

  // de onde é o prêmio
  escrever(ctx, dados.pelada, MARGEM, 1806, {
    peso: 800,
    tamanho: 34,
    cor: BRANCO,
    largura: util,
  });
  if (dados.turma) {
    escrever(ctx, dados.turma, MARGEM, 1852, {
      peso: 600,
      tamanho: 26,
      cor: MENTA,
      largura: util * 0.6,
    });
  }
  escrever(ctx, hostDoSite(), LARGURA - MARGEM, 1852, {
    peso: 600,
    tamanho: 26,
    cor: APAGADO,
    largura: util * 0.38,
    alinhar: "right",
  });

  if (dados.premium && MVPS_MARCANTES.includes(dados.mvps)) medalhao(ctx, dados.mvps);
  if (dados.premium && dados.moldura) molduraDoCartao(ctx, dados.moldura);

  return canvas;
}

/** Cartão do MVP já como arquivo de imagem (pra pré-visualizar e depois compartilhar). */
export const gerarCartaoMvp = async (dados: DadosDoMvp) =>
  paraArquivo(await desenharCartaoMvp(dados));
