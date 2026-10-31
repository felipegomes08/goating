import { Link } from "@tanstack/react-router";
import { ChevronRight, Trophy } from "lucide-react";
import { useTabelaDaLiga } from "@/hooks/use-ligas";

type DadosDaLiga = {
  evento?: "rodada" | "fim";
  liga_id?: string;
  liga?: string;
  rodada?: number;
  lider?: string | null;
  pontos?: number;
};

/**
 * Mensagem da liga no chat. Na rodada: quem lidera e o top 3 de agora. No fim: o campeão e o
 * caminho pra ver os premiados e o cartão do campeão.
 */
export function CartaoLiga({ dados }: { dados: unknown }) {
  const d = (dados ?? {}) as DadosDaLiga;
  const fim = d.evento === "fim";
  const tabela = useTabelaDaLiga(!fim && d.liga_id ? d.liga_id : null);
  const top = (tabela.data ?? []).slice(0, 3);
  if (!d.liga_id) return null;

  return (
    <Link
      to="/liga/$id"
      params={{ id: d.liga_id }}
      className="block w-full overflow-hidden rounded-2xl border border-tier-ouro/40 bg-card shadow-sm"
    >
      <div className="bg-gradient-to-br from-tier-ouro/25 to-tier-ouro/5 px-4 py-3">
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-amber-700 uppercase">
          <Trophy className="size-3.5" /> {d.liga ?? "Liga"}
          {!fim && d.rodada ? ` · Rodada ${d.rodada}` : ""}
        </p>
        <p className="mt-0.5 text-base leading-tight font-extrabold text-foreground">
          {fim
            ? d.lider
              ? `🏆 ${d.lider} ${d.lider.includes(" e ") ? "são os campeões" : "é o campeão"}!`
              : "A liga acabou!"
            : d.lider
              ? `${d.lider.split(" ")[0]} lidera com ${d.pontos ?? 0} pontos`
              : "Tabela atualizada"}
        </p>
      </div>
      {!fim && top.length > 0 && (
        <ol className="divide-y divide-border px-4">
          {top.map((l) => (
            <li key={l.member_id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="w-5 text-xs font-bold text-muted-foreground">
                {l.posicao === 1 ? "👑" : `${l.posicao}º`}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                {l.nome}
              </span>
              <span className="font-black text-primary tabular-nums">{l.pontos}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="flex items-center justify-end gap-1 px-4 py-2 text-xs font-bold text-primary">
        {fim ? "Ver premiados e o cartão do campeão" : "Ver tabela"}
        <ChevronRight className="size-3.5" />
      </p>
    </Link>
  );
}
