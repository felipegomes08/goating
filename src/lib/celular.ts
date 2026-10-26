/** Celular brasileiro: guardado só com os dígitos (DDD + 9 dígitos), mostrado com máscara. */

/** DDDs que existem no Brasil. */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Só os dígitos, no máximo 11. Quem cola com "+55" na frente tem o 55 tirado. */
export function digitosDoCelular(texto: string) {
  let digitos = texto.replace(/\D/g, "");
  if (digitos.length > 11 && digitos.startsWith("55")) digitos = digitos.slice(2);
  return digitos.slice(0, 11);
}

/** Máscara enquanto digita: "(11) 98765-4321". */
export function formatarCelular(digitos: string) {
  const d = digitosDoCelular(digitos);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Devolve o motivo de não servir, ou null quando está vazio (é opcional) ou é válido. */
export function problemaDoCelular(digitos: string) {
  if (digitos.length === 0) return null;
  if (digitos.length < 11) return "Digite o DDD e os 9 dígitos do celular.";
  if (!DDDS.has(Number(digitos.slice(0, 2)))) return "Esse DDD não existe.";
  if (digitos[2] !== "9") return "Celular começa com 9 depois do DDD.";
  return null;
}
