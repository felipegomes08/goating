import { cn } from "@/lib/utils";

const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

/**
 * Horário em 24h (formato do Brasil), com hora e minuto em listas.
 * O campo de horário do navegador segue a configuração do aparelho e mostra AM/PM
 * em celular configurado em 12h; aqui é sempre 19:30, nunca 7:30 PM.
 */
export function CampoHorario({
  id,
  rotulo,
  valor,
  onMudar,
  className,
}: {
  id: string;
  /** usado pelos leitores de tela: "Início", "Término" */
  rotulo: string;
  /** "HH:MM" */
  valor: string;
  onMudar: (valor: string) => void;
  className?: string;
}) {
  const [hora = "19", minuto = "00"] = valor.split(":");
  // um minuto fora dos múltiplos de 5 (valor antigo) continua aparecendo na lista
  const minutos = MINUTOS.includes(minuto) ? MINUTOS : [...MINUTOS, minuto].sort();

  const lista =
    "h-full flex-1 appearance-none bg-transparent text-center text-base font-semibold text-foreground tabular-nums focus-visible:outline-none";

  return (
    <div
      className={cn(
        "flex h-11 items-center rounded-xl border border-input bg-card px-2 focus-within:ring-1 focus-within:ring-ring",
        className,
      )}
    >
      <select
        id={id}
        aria-label={`${rotulo}: hora`}
        value={hora}
        onChange={(e) => onMudar(`${e.target.value}:${minuto}`)}
        className={lista}
      >
        {HORAS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="font-bold text-muted-foreground" aria-hidden>
        :
      </span>
      <select
        aria-label={`${rotulo}: minuto`}
        value={minuto}
        onChange={(e) => onMudar(`${hora}:${e.target.value}`)}
        className={lista}
      >
        {minutos.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
