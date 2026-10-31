import type { LucideIcon } from "lucide-react";

/** Aba de algo que ainda vai chegar: ícone, nome e o que vai ter ali. */
export function EmBreve({
  icone: Icone,
  titulo,
  texto,
}: {
  icone: LucideIcon;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="mt-10 flex flex-col items-center px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-mint-soft">
        <Icone className="size-7 text-primary" strokeWidth={1.8} />
      </span>
      <span className="mt-4 rounded-full bg-tier-ouro/20 px-3 py-1 text-[11px] font-extrabold tracking-wide text-amber-700 uppercase">
        Em breve
      </span>
      <p className="mt-2 text-base font-semibold text-foreground">{titulo}</p>
      <p className="mt-1 max-w-[300px] text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}
