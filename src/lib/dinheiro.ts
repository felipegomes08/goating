/** Dinheiro em reais, guardado em centavos. */

/** 1500 vira "R$ 15,00". */
export const formatarReais = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Máscara do campo de valor: só os dígitos, lidos como centavos ("1500" = R$ 15,00). */
export function centavosDoTexto(texto: string) {
  const digitos = texto.replace(/\D/g, "").replace(/^0+/, "").slice(0, 7);
  return digitos ? Number(digitos) : 0;
}
