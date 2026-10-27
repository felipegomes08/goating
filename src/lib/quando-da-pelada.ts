const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "hoje às 19:00", "amanhã às 19:00" ou "qui, 30/10 às 19:00". */
export function quandoDaPelada(data: string, horario: string) {
  const dia = new Date(`${data}T12:00:00`);
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  const distancia = Math.round((dia.getTime() - hoje.getTime()) / 86_400_000);
  const rotulo =
    distancia === 0
      ? "hoje"
      : distancia === 1
        ? "amanhã"
        : `${SEMANA[dia.getDay()]}, ${String(dia.getDate()).padStart(2, "0")}/${String(dia.getMonth() + 1).padStart(2, "0")}`;
  return `${rotulo} às ${horario.slice(0, 5)}`;
}
