/**
 * O que falta em navegadores mais antigos e que o app usa. O iPhone com iOS anterior ao 15.4 não
 * tem `crypto.randomUUID`, e ele é chamado logo ao abrir (os canais em tempo real do chat e do
 * sino), o que derrubava o app inteiro. `crypto.getRandomValues` existe em todos.
 */
if (typeof crypto !== "undefined" && typeof crypto.randomUUID !== "function") {
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => {
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6]! & 0x0f) | 0x40;
      b[8] = (b[8]! & 0x3f) | 0x80;
      const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    },
  });
}

export {};
