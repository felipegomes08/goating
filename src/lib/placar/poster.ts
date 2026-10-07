/** Pôster do resumo da pelada e tabela do ranking: imagens prontas pra mandar no grupo. */

import iconeBranco from "@/assets/icone-logo-fundo-branco.png.asset.json";
import letreiroBranco from "@/assets/logo_so_texto_branco.png.asset.json";

export type DadosDoPoster = {
  titulo: string;
  data: string;
  manchete: string;
  /** jogo único: placar grande no meio */
  placar?: { timeA: string; golsA: number; timeB: string; golsB: number } | undefined;
  /** vários jogos: classificação dos times no dia */
  tabela?: { nome: string; vitorias: number; empates: number; derrotas: number }[] | undefined;
  artilharia: { nome: string; gols: number }[];
  /** foto da galera (câmera ou galeria); entra grande, logo abaixo do título */
  foto?: Blob | null | undefined;
};

const LARGURA = 1080;
const ALTURA = 1350;
/** com foto o pôster cresce pra ela caber sem espremer o placar */
const ALTURA_COM_FOTO = 2000;
const ALTURA_DA_FOTO = 620;
const MARGEM = 80;
const FONTE = "Poppins, system-ui, sans-serif";

// Canvas não lê as variáveis de cor do tema: mesmas cores, em hexadecimal.
const VERDE = "#0F3D2E";
const VERDE_CLARO = "#17573F";
const MENTA = "#7FE0A0";
const OURO = "#E9BC4B";
const BRANCO = "#FFFFFF";
const APAGADO = "rgba(255,255,255,0.6)";

type Ctx = CanvasRenderingContext2D;

const fonte = (peso: number, tamanho: number) => `${peso} ${tamanho}px ${FONTE}`;

/** Escreve diminuindo a letra até caber na largura. */
function escrever(
  ctx: Ctx,
  texto: string,
  x: number,
  y: number,
  opcoes: {
    peso: number;
    tamanho: number;
    cor: string;
    largura: number;
    alinhar?: CanvasTextAlign;
    /** menor letra aceita antes de cortar o texto com reticências */
    minimo?: number;
  },
) {
  let tamanho = opcoes.tamanho;
  ctx.font = fonte(opcoes.peso, tamanho);
  while (ctx.measureText(texto).width > opcoes.largura && tamanho > (opcoes.minimo ?? 22)) {
    tamanho -= 2;
    ctx.font = fonte(opcoes.peso, tamanho);
  }
  let visivel = texto;
  while (ctx.measureText(visivel).width > opcoes.largura && visivel.length > 2) {
    visivel = `${visivel.slice(0, -2).trimEnd()}…`;
  }
  ctx.fillStyle = opcoes.cor;
  ctx.textAlign = opcoes.alinhar ?? "left";
  ctx.fillText(visivel, x, y);
}

function retanguloArredondado(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

function coroa(ctx: Ctx, x: number, y: number, tamanho: number) {
  const w = tamanho;
  const h = tamanho * 0.72;
  ctx.fillStyle = OURO;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + h * 0.25);
  ctx.lineTo(x + w * 0.27, y + h * 0.62);
  ctx.lineTo(x + w * 0.5, y);
  ctx.lineTo(x + w * 0.73, y + h * 0.62);
  ctx.lineTo(x + w, y + h * 0.25);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
}

function fundo(ctx: Ctx, altura: number, centroDoCirculo: number) {
  ctx.fillStyle = VERDE;
  ctx.fillRect(0, 0, LARGURA, altura);

  const luz = ctx.createRadialGradient(LARGURA / 2, 380, 60, LARGURA / 2, 380, 900);
  luz.addColorStop(0, VERDE_CLARO);
  luz.addColorStop(1, "rgba(15,61,46,0)");
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, LARGURA, altura);

  // faixas do gramado e o círculo central, bem de leve
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let y = 0; y < altura; y += 270) ctx.fillRect(0, y, LARGURA, 135);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(LARGURA / 2, centroDoCirculo, 250, 0, Math.PI * 2);
  ctx.stroke();
}

/** Baixa a imagem como arquivo antes de desenhar: assim o canvas nunca fica "travado" pra exportar. */
async function carregarImagem(url: string) {
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    return await createImageBitmap(await resposta.blob());
  } catch {
    return null;
  }
}

/** Logo do Goating no canto de cima. Se a imagem não carregar, vai o nome escrito. */
async function desenharLogo(ctx: Ctx) {
  const [icone, letreiro] = await Promise.all([
    carregarImagem(iconeBranco.url),
    carregarImagem(letreiroBranco.url),
  ]);
  if (!icone || !letreiro) {
    escrever(ctx, "GOATING", MARGEM, 120, { peso: 900, tamanho: 38, cor: MENTA, largura: 300 });
    return;
  }
  const lado = 68;
  const topo = 72;
  ctx.drawImage(icone, MARGEM, topo, lado, lado);
  const alturaLetreiro = 46;
  const larguraLetreiro = (letreiro.width / letreiro.height) * alturaLetreiro;
  ctx.drawImage(
    letreiro,
    MARGEM + lado + 16,
    topo + (lado - alturaLetreiro) / 2,
    larguraLetreiro,
    alturaLetreiro,
  );
}

/** Foto cobrindo o retângulo inteiro (corta as sobras), com cantos arredondados. */
async function desenharFoto(ctx: Ctx, foto: Blob, x: number, y: number, w: number, h: number) {
  let imagem: ImageBitmap;
  try {
    // respeita a rotação que a câmera do celular grava no arquivo
    imagem = await createImageBitmap(foto, { imageOrientation: "from-image" });
  } catch {
    return false;
  }
  const escala = Math.max(w / imagem.width, h / imagem.height);
  const lw = imagem.width * escala;
  const lh = imagem.height * escala;
  ctx.save();
  retanguloArredondado(ctx, x, y, w, h, 36);
  ctx.clip();
  // um pouco acima do centro: em foto de time as cabeças ficam na parte de cima
  ctx.drawImage(imagem, x + (w - lw) / 2, y + (h - lh) * 0.4, lw, lh);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 4;
  retanguloArredondado(ctx, x, y, w, h, 36);
  ctx.stroke();
  return true;
}

export async function desenharPoster(dados: DadosDoPoster): Promise<HTMLCanvasElement> {
  // sem isso o primeiro desenho pode sair com a fonte reserva do sistema
  await Promise.all(
    [600, 800, 900].map((peso) => document.fonts.load(fonte(peso, 40)).catch(() => undefined)),
  );

  const altura = dados.foto ? ALTURA_COM_FOTO : ALTURA;
  const canvas = document.createElement("canvas");
  canvas.width = LARGURA;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Esse navegador não desenha imagens.");
  const util = LARGURA - MARGEM * 2;
  const meio = LARGURA / 2;
  ctx.textBaseline = "alphabetic";

  fundo(ctx, altura, dados.foto ? 1110 : 470);
  await desenharLogo(ctx);

  escrever(ctx, dados.data.toUpperCase(), LARGURA - MARGEM, 120, {
    peso: 600,
    tamanho: 26,
    cor: APAGADO,
    largura: 560,
    alinhar: "right",
  });
  escrever(ctx, dados.titulo, meio, 240, {
    peso: 800,
    tamanho: 64,
    cor: BRANCO,
    largura: util,
    alinhar: "center",
  });

  let y = 300;

  if (dados.foto && (await desenharFoto(ctx, dados.foto, MARGEM, y, util, ALTURA_DA_FOTO))) {
    y += ALTURA_DA_FOTO + 20;
  }

  if (dados.placar) {
    const { timeA, golsA, timeB, golsB } = dados.placar;
    const coluna = util / 2 - 70;
    escrever(ctx, timeA.toUpperCase(), MARGEM + coluna / 2, y + 70, {
      peso: 800,
      tamanho: 40,
      cor: golsA >= golsB ? MENTA : APAGADO,
      largura: coluna,
      alinhar: "center",
    });
    escrever(ctx, timeB.toUpperCase(), LARGURA - MARGEM - coluna / 2, y + 70, {
      peso: 800,
      tamanho: 40,
      cor: golsB >= golsA ? MENTA : APAGADO,
      largura: coluna,
      alinhar: "center",
    });
    escrever(ctx, String(golsA), MARGEM + coluna / 2, y + 330, {
      peso: 900,
      tamanho: 260,
      cor: BRANCO,
      largura: coluna,
      alinhar: "center",
    });
    escrever(ctx, String(golsB), LARGURA - MARGEM - coluna / 2, y + 330, {
      peso: 900,
      tamanho: 260,
      cor: BRANCO,
      largura: coluna,
      alinhar: "center",
    });
    escrever(ctx, "×", meio, y + 290, {
      peso: 600,
      tamanho: 90,
      cor: APAGADO,
      largura: 100,
      alinhar: "center",
    });
    y += 400;
  } else if (dados.tabela?.length) {
    y += 20;
    const linhas = dados.tabela.slice(0, 4);
    linhas.forEach((time, i) => {
      const topo = y + i * 92;
      ctx.fillStyle = i === 0 ? "rgba(127,224,160,0.16)" : "rgba(255,255,255,0.06)";
      retanguloArredondado(ctx, MARGEM, topo, util, 76, 22);
      ctx.fill();
      escrever(ctx, `${i + 1}`, MARGEM + 34, topo + 52, {
        peso: 800,
        tamanho: 34,
        cor: i === 0 ? MENTA : APAGADO,
        largura: 40,
      });
      escrever(ctx, time.nome, MARGEM + 90, topo + 52, {
        peso: 800,
        tamanho: 36,
        cor: BRANCO,
        largura: util - 420,
      });
      escrever(
        ctx,
        `${time.vitorias}V  ${time.empates}E  ${time.derrotas}D`,
        LARGURA - MARGEM - 34,
        topo + 52,
        { peso: 600, tamanho: 32, cor: i === 0 ? MENTA : APAGADO, largura: 300, alinhar: "right" },
      );
    });
    y += linhas.length * 92 + 20;
  }

  // manchete numa pílula
  ctx.font = fonte(800, 38);
  const larguraPilula = Math.min(util, ctx.measureText(dados.manchete).width + 96);
  ctx.fillStyle = MENTA;
  retanguloArredondado(ctx, meio - larguraPilula / 2, y, larguraPilula, 84, 42);
  ctx.fill();
  escrever(ctx, dados.manchete, meio, y + 56, {
    peso: 800,
    tamanho: 38,
    cor: VERDE,
    largura: larguraPilula - 64,
    alinhar: "center",
  });
  y += 150;

  // artilharia: o que couber até o rodapé
  const artilheiros = dados.artilharia.slice(
    0,
    Math.max(0, Math.floor((altura - 120 - (y + 30)) / 82)),
  );
  if (artilheiros.length > 0) {
    escrever(ctx, "ARTILHARIA", MARGEM, y, { peso: 800, tamanho: 28, cor: APAGADO, largura: util });
    y += 30;
    const maisGols = artilheiros[0]?.gols ?? 0;
    artilheiros.forEach((jogador, i) => {
      const base = y + 58 + i * 82;
      const lider = jogador.gols === maisGols;
      if (lider) coroa(ctx, MARGEM, base - 38, 46);
      else {
        escrever(ctx, `${i + 1}`, MARGEM + 6, base, {
          peso: 800,
          tamanho: 34,
          cor: APAGADO,
          largura: 50,
        });
      }
      escrever(ctx, jogador.nome, MARGEM + 76, base, {
        peso: lider ? 800 : 600,
        tamanho: 42,
        cor: BRANCO,
        largura: util - 220,
      });
      escrever(ctx, String(jogador.gols), LARGURA - MARGEM, base + 4, {
        peso: 900,
        tamanho: 56,
        cor: lider ? OURO : MENTA,
        largura: 120,
        alinhar: "right",
      });
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(MARGEM, base + 24, util, 2);
    });
  }

  escrever(ctx, window.location.host, meio, altura - 70, {
    peso: 600,
    tamanho: 26,
    cor: APAGADO,
    largura: util,
    alinhar: "center",
  });

  return canvas;
}

export type LinhaDoRanking = {
  nome: string;
  jogos: number;
  vitorias: number;
  gols: number;
  /** já formatada: "1,2" */
  media: string;
  aproveitamento: number;
};

export type DadosDoRanking = {
  turma: string;
  periodo: string;
  /** índice da coluna que ordena a tabela (0 = J ... 4 = %) */
  colunaOrdenada: number;
  linhas: LinhaDoRanking[];
};

const COLUNAS_RANKING = ["J", "V", "G", "M", "%"];
const MAX_LINHAS_RANKING = 15;

/** Tabela do ranking da turma como imagem: altura acompanha a quantidade de jogadores. */
export async function desenharRanking(dados: DadosDoRanking): Promise<HTMLCanvasElement> {
  await Promise.all(
    [600, 800, 900].map((peso) => document.fonts.load(fonte(peso, 40)).catch(() => undefined)),
  );

  const linhas = dados.linhas.slice(0, MAX_LINHAS_RANKING);
  const ALTURA_LINHA = 78;
  const TOPO_TABELA = 400;
  const altura = TOPO_TABELA + linhas.length * ALTURA_LINHA + 190;

  const canvas = document.createElement("canvas");
  canvas.width = LARGURA;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Esse navegador não desenha imagens.");
  const util = LARGURA - MARGEM * 2;
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = VERDE;
  ctx.fillRect(0, 0, LARGURA, altura);
  const luz = ctx.createRadialGradient(LARGURA / 2, 200, 60, LARGURA / 2, 200, 900);
  luz.addColorStop(0, VERDE_CLARO);
  luz.addColorStop(1, "rgba(15,61,46,0)");
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, LARGURA, altura);

  await desenharLogo(ctx);
  escrever(ctx, "RANKING DA TURMA", LARGURA - MARGEM, 120, {
    peso: 600,
    tamanho: 26,
    cor: APAGADO,
    largura: 500,
    alinhar: "right",
  });
  escrever(ctx, dados.turma, MARGEM, 220, { peso: 800, tamanho: 64, cor: BRANCO, largura: util });
  escrever(ctx, dados.periodo, MARGEM, 272, { peso: 600, tamanho: 30, cor: MENTA, largura: util });

  // colunas de número, da direita pra esquerda
  const LARGURA_COLUNA = 104;
  const xColuna = (i: number) =>
    LARGURA - MARGEM - 24 - (COLUNAS_RANKING.length - 1 - i) * LARGURA_COLUNA;
  const xNome = MARGEM + 96;
  const larguraNome = xColuna(0) - LARGURA_COLUNA + 20 - xNome;

  COLUNAS_RANKING.forEach((rotulo, i) => {
    escrever(ctx, rotulo, xColuna(i), TOPO_TABELA - 30, {
      peso: 800,
      tamanho: 28,
      cor: i === dados.colunaOrdenada ? MENTA : APAGADO,
      largura: LARGURA_COLUNA,
      alinhar: "right",
    });
  });
  escrever(ctx, "JOGADOR", xNome, TOPO_TABELA - 30, {
    peso: 800,
    tamanho: 24,
    cor: APAGADO,
    largura: larguraNome,
  });

  linhas.forEach((l, i) => {
    const topo = TOPO_TABELA + i * ALTURA_LINHA;
    const base = topo + 52;
    if (i % 2 === 0) {
      ctx.fillStyle = i === 0 ? "rgba(127,224,160,0.16)" : "rgba(255,255,255,0.05)";
      retanguloArredondado(ctx, MARGEM, topo, util, ALTURA_LINHA - 8, 20);
      ctx.fill();
    }
    if (i === 0) coroa(ctx, MARGEM + 22, base - 34, 42);
    else {
      escrever(ctx, `${i + 1}`, MARGEM + 64, base, {
        peso: 800,
        tamanho: 32,
        cor: APAGADO,
        largura: 60,
        alinhar: "right",
      });
    }
    escrever(ctx, l.nome, xNome, base, {
      peso: i === 0 ? 800 : 600,
      tamanho: 36,
      cor: BRANCO,
      largura: larguraNome,
      minimo: 30,
    });
    [String(l.jogos), String(l.vitorias), String(l.gols), l.media, `${l.aproveitamento}`].forEach(
      (valor, c) => {
        const ordenada = c === dados.colunaOrdenada;
        escrever(ctx, valor, xColuna(c), base, {
          peso: ordenada ? 900 : 600,
          tamanho: ordenada ? 38 : 34,
          cor: ordenada ? (i === 0 ? OURO : MENTA) : BRANCO,
          largura: LARGURA_COLUNA - 8,
          alinhar: "right",
        });
      },
    );
  });

  const rodape = TOPO_TABELA + linhas.length * ALTURA_LINHA + 50;
  escrever(
    ctx,
    "J jogos  ·  V vitórias  ·  G gols  ·  M gols por jogo  ·  % aproveitamento",
    LARGURA / 2,
    rodape,
    { peso: 600, tamanho: 24, cor: APAGADO, largura: util, alinhar: "center" },
  );
  escrever(ctx, window.location.host, LARGURA / 2, altura - 60, {
    peso: 600,
    tamanho: 26,
    cor: APAGADO,
    largura: util,
    alinhar: "center",
  });

  return canvas;
}

async function paraArquivo(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Não deu pra gerar a imagem.");
  return blob;
}

/** Pôster do resumo já como arquivo de imagem (pra pré-visualizar e depois compartilhar). */
export const gerarPoster = async (dados: DadosDoPoster) => paraArquivo(await desenharPoster(dados));

export const compartilharRanking = async (dados: DadosDoRanking, nomeDoArquivo: string) =>
  compartilharImagem(await paraArquivo(await desenharRanking(dados)), nomeDoArquivo);

/** Abre a folha de compartilhar do celular com a imagem; onde não dá, baixa o arquivo. */
export async function compartilharImagem(blob: Blob, nomeDoArquivo: string) {
  const arquivo = new File([blob], nomeDoArquivo, { type: "image/png" });

  if (typeof navigator.share === "function" && navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo] });
      return "compartilhado" as const;
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === "AbortError") return "cancelado" as const;
      // navegador recusou compartilhar arquivo: cai pro baixar
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeDoArquivo;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "baixado" as const;
}
