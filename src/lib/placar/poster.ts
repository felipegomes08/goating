/** Pôster do resumo da pelada: uma imagem pronta pra mandar no grupo. */

export type DadosDoPoster = {
  titulo: string;
  data: string;
  manchete: string;
  /** jogo único: placar grande no meio */
  placar?: { timeA: string; golsA: number; timeB: string; golsB: number } | undefined;
  /** vários jogos: classificação dos times no dia */
  tabela?: { nome: string; vitorias: number; empates: number; derrotas: number }[] | undefined;
  artilharia: { nome: string; gols: number }[];
};

const LARGURA = 1080;
const ALTURA = 1350;
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
  },
) {
  let tamanho = opcoes.tamanho;
  ctx.font = fonte(opcoes.peso, tamanho);
  while (ctx.measureText(texto).width > opcoes.largura && tamanho > 22) {
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

function fundo(ctx: Ctx) {
  ctx.fillStyle = VERDE;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  const luz = ctx.createRadialGradient(LARGURA / 2, 380, 60, LARGURA / 2, 380, 900);
  luz.addColorStop(0, VERDE_CLARO);
  luz.addColorStop(1, "rgba(15,61,46,0)");
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  // faixas do gramado e o círculo central, bem de leve
  ctx.fillStyle = "rgba(255,255,255,0.025)";
  for (let y = 0; y < ALTURA; y += 270) ctx.fillRect(0, y, LARGURA, 135);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(LARGURA / 2, 470, 250, 0, Math.PI * 2);
  ctx.stroke();
}

export async function desenharPoster(dados: DadosDoPoster): Promise<HTMLCanvasElement> {
  // sem isso o primeiro desenho pode sair com a fonte reserva do sistema
  await Promise.all(
    [600, 800, 900].map((peso) => document.fonts.load(fonte(peso, 40)).catch(() => undefined)),
  );

  const canvas = document.createElement("canvas");
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Esse navegador não desenha imagens.");
  const util = LARGURA - MARGEM * 2;
  const meio = LARGURA / 2;
  ctx.textBaseline = "alphabetic";

  fundo(ctx);

  escrever(ctx, "GOATING", MARGEM, 120, { peso: 900, tamanho: 38, cor: MENTA, largura: 300 });
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
    Math.max(0, Math.floor((ALTURA - 120 - (y + 30)) / 82)),
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

  escrever(ctx, window.location.host, meio, ALTURA - 70, {
    peso: 600,
    tamanho: 26,
    cor: APAGADO,
    largura: util,
    alinhar: "center",
  });

  return canvas;
}

/** Abre a folha de compartilhar do celular com a imagem; onde não dá, baixa o arquivo. */
export async function compartilharPoster(dados: DadosDoPoster, nomeDoArquivo: string) {
  const canvas = await desenharPoster(dados);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Não deu pra gerar a imagem.");
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
