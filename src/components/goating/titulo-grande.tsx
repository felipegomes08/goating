import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Cabeçalho verde das telas de lista: título grande no estilo iOS, base arredondada. */
export function TituloGrande({
  titulo,
  subtitulo,
  acao,
  children,
}: {
  titulo: string;
  subtitulo?: string | undefined;
  /** botão ou link no canto direito */
  acao?: ReactNode;
  /** busca, abas... logo abaixo do título */
  children?: ReactNode;
}) {
  return (
    <header className="space-y-3 rounded-b-3xl bg-primary px-4 pt-6 pb-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight text-primary-foreground">
            {titulo}
          </h1>
          {subtitulo && <p className="mt-0.5 text-sm text-mint">{subtitulo}</p>}
        </div>
        {acao}
      </div>
      {children}
    </header>
  );
}

/** Campo de busca pra usar sobre o verde: translúcido, sem borda. */
export const CAMPO_NO_VERDE =
  "border-0 bg-white/10 pl-9 text-[15px] text-primary-foreground placeholder:text-primary-foreground/55 focus-visible:ring-mint";

/** Trilho do controle segmentado (abas lado a lado), sobre o verde. */
export function Segmentos({ children, colunas }: { children: ReactNode; colunas: 2 | 3 | 4 }) {
  return (
    <div
      className={cn(
        "grid gap-1 rounded-xl bg-white/10 p-1",
        colunas === 2 ? "grid-cols-2" : colunas === 3 ? "grid-cols-3" : "grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}

export const classeSegmento = (ativo: boolean) =>
  cn(
    "truncate rounded-lg py-1.5 text-center text-xs font-semibold transition-colors",
    ativo ? "bg-card text-primary shadow-sm" : "text-primary-foreground/70",
  );
