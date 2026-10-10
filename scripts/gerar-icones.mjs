// Monta as imagens-base do ícone e da tela de abertura do app, a partir das logos originais.
// Depois é só rodar `npx @capacitor/assets generate`, que recorta todos os tamanhos
// que o Android e o iOS pedem.
//
// Uso: node scripts/gerar-icones.mjs <pasta das logos originais>
//
// A logo do ícone vem como um quadrado de cantos arredondados sobre preto. As lojas aplicam
// a própria máscara (círculo, quadrado arredondado...), então aqui o miolo da logo é colado
// num quadrado inteiro da mesma cor de fundo, sem cantos e com folga em volta.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const origem = process.argv[2];
if (!origem) {
  console.error("Diga a pasta das logos: node scripts/gerar-icones.mjs <pasta>");
  process.exit(1);
}
const ICONE = join(origem, "Logo de Cabra com Letra G.png");
const LETREIRO = join(origem, "Logotipo Goating com Folha Verde.png");
const VERDE_DO_APP = "#0F3D2E";
const destino = "assets";
mkdirSync(destino, { recursive: true });

// miolo da logo: por dentro dos cantos arredondados
const RECORTE = { left: 100, top: 100, width: 1054, height: 1054 };
const { data: px, info } = await sharp(ICONE)
  .extract(RECORTE)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

// Solta o desenho do fundo. O fundo original é um verde bem escuro com degradê; o desenho é
// verde claro e branco. O quanto o pixel é claro vira a transparência, e a cor é refeita
// limpa (verde ou branco), pra borda não carregar resto do fundo antigo.
const VERDE_CLARO = [92, 245, 144];
const solto = Buffer.alloc(info.width * info.height * 4);
for (let i = 0, o = 0; i < px.length; i += 3, o += 4) {
  const r = px[i];
  const g = px[i + 1];
  // a beirada do recorte ainda pega um resto da moldura original: ali fica tudo transparente
  const x = (i / 3) % info.width;
  const y = Math.floor(i / 3 / info.width);
  const naBeirada = x < 40 || y < 40 || x >= info.width - 40 || y >= info.height - 40;
  const alfa = naBeirada ? 0 : Math.max(0, Math.min(1, (g - 80) / 90));
  // o vermelho separa o branco (alto) do verde claro (baixo)
  const branco = Math.max(0, Math.min(1, (r - 110) / 120));
  solto[o] = Math.round(VERDE_CLARO[0] + (255 - VERDE_CLARO[0]) * branco);
  solto[o + 1] = Math.round(VERDE_CLARO[1] + (255 - VERDE_CLARO[1]) * branco);
  solto[o + 2] = Math.round(VERDE_CLARO[2] + (255 - VERDE_CLARO[2]) * branco);
  solto[o + 3] = Math.round(alfa * 255);
}
const desenho = await sharp(solto, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png()
  .toBuffer();

/** Fundo do ícone: o verde escuro da logo, um pouco mais claro no centro. */
const fundoSvg = (lado) =>
  Buffer.from(
    `<svg width="${lado}" height="${lado}"><defs><radialGradient id="g" cx="0.5" cy="0.45" r="0.75">
       <stop offset="0" stop-color="#06382A"/><stop offset="1" stop-color="#021C14"/>
     </radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );

/** Quadrado com o fundo do ícone e o desenho no meio, ocupando `proporcao` do lado. */
async function quadrado(lado, proporcao) {
  const tamanho = Math.round(lado * proporcao);
  const logo = await sharp(desenho).resize(tamanho, tamanho).png().toBuffer();
  return sharp(fundoSvg(lado)).composite([{ input: logo, gravity: "center" }]).png();
}

// ícone clássico e do iOS: a logo quase de ponta a ponta
await (await quadrado(1024, 0.86)).toFile(join(destino, "icon-only.png"));
// ícone adaptável do Android: o sistema corta as bordas, então a logo fica menor, no centro
await (await quadrado(1024, 0.62)).toFile(join(destino, "icon-foreground.png"));
await sharp(fundoSvg(1024)).png().toFile(join(destino, "icon-background.png"));

// tela de abertura: verde do app com o letreiro branco no meio
const letreiro = await sharp(LETREIRO).resize({ width: 1100 }).png().toBuffer();
for (const nome of ["splash.png", "splash-dark.png"]) {
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: VERDE_DO_APP } })
    .composite([{ input: letreiro, gravity: "center" }])
    .png()
    .toFile(join(destino, nome));
}

console.log(`Imagens em ${destino}/`);
