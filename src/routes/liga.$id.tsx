import { useState } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useVoltar } from "@/hooks/use-voltar";
import { useLiga, usePremiosDaLiga, useRodadasDaLiga, useTabelaDaLiga } from "@/hooks/use-ligas";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CabecalhoDaLiga } from "@/components/goating/liga/cabecalho-da-liga";
import { LideresDaLiga, TabelaDaLiga } from "@/components/goating/liga/tabela-da-liga";
import { PremiadosDaLiga } from "@/components/goating/liga/premiados";
import { FolhaLiga } from "@/components/goating/liga/folha-liga";
import { situacaoDaLiga } from "@/lib/ligas";

export const Route = createFileRoute("/liga/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Liga · Goating" }] }),
  component: PaginaDaLiga,
});

/** A liga inteira: tabela, líderes e, quando acaba, o campeão e os premiados. */
function PaginaDaLiga() {
  const { id } = useParams({ from: "/liga/$id" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId } = useSession();
  const liga = useLiga(id);
  const tabela = useTabelaDaLiga(id);
  const rodadas = useRodadasDaLiga(liga.data ?? null);
  const encerrada = !!liga.data?.encerrada_em;
  const premios = usePremiosDaLiga(id, encerrada);
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState<"encerrar" | "apagar" | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const crewId = liga.data?.crew_id;
  const voltar = useVoltar(() =>
    crewId
      ? void navigate({ to: "/turma/$id", params: { id: crewId }, search: { aba: "liga" } })
      : void navigate({ to: "/" }),
  );

  const turma = useQuery({
    queryKey: ["liga-turma", crewId, userId],
    enabled: !!crewId && !!userId,
    queryFn: async () => {
      const [crew, eu] = await Promise.all([
        supabase.from("crews").select("nome, dono_id").eq("id", crewId!).maybeSingle(),
        supabase
          .from("crew_members")
          .select("admin")
          .eq("crew_id", crewId!)
          .eq("user_id", userId!)
          .is("removido_em", null)
          .maybeSingle(),
      ]);
      return {
        nome: crew.data?.nome ?? null,
        souGestor: crew.data?.dono_id === userId || !!eu.data?.admin,
      };
    },
  });

  async function executar(acao: "encerrar" | "apagar") {
    setOcupado(true);
    const { error } =
      acao === "encerrar"
        ? await supabase.rpc("encerrar_liga", { p_liga_id: id })
        : await supabase.rpc("apagar_liga", { p_liga_id: id });
    setOcupado(false);
    setConfirmando(null);
    if (error) {
      toast.error(
        /[áéíóúãõç]/i.test(error.message) ? error.message : "Não deu pra fazer isso agora.",
      );
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["ligas-da-turma", crewId] });
    if (acao === "apagar") {
      toast.success("Liga apagada.");
      voltar();
      return;
    }
    toast.success("Liga encerrada. Os prêmios saíram! 🏆");
    await queryClient.invalidateQueries({ queryKey: ["liga", id] });
    await queryClient.invalidateQueries({ queryKey: ["premios-da-liga", id] });
  }

  if (liga.isLoading) {
    return (
      <div className="app-shell space-y-3 p-4">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }
  if (!liga.data) {
    return (
      <div className="app-shell flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">Essa liga não existe mais.</p>
        <Button asChild>
          <Link to="/turmas">Ver minhas turmas</Link>
        </Button>
      </div>
    );
  }

  const situacao = situacaoDaLiga(liga.data);
  const gestor = !!turma.data?.souGestor;

  return (
    <div className="app-shell flex min-h-dvh flex-col bg-background">
      <header className="flex items-center gap-3 bg-primary px-4 pt-4 pb-3">
        <button type="button" aria-label="Voltar" onClick={voltar}>
          <ArrowLeft className="size-5 text-primary-foreground" />
        </button>
        <span className="truncate text-xs font-semibold tracking-wide text-mint uppercase">
          {turma.data?.nome ?? "Turma"}
        </span>
      </header>

      <main className="flex-1 space-y-4 p-4">
        <CabecalhoDaLiga liga={liga.data} rodadas={rodadas.data ?? 0} />

        {encerrada && premios.data && (
          <PremiadosDaLiga
            liga={liga.data}
            turma={turma.data?.nome ?? null}
            premios={premios.data}
            tabela={tabela.data ?? []}
          />
        )}

        {situacao !== "futura" &&
          (tabela.isLoading ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : (
            <>
              <h3 className="px-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                {encerrada ? "Tabela final" : "Tabela"}
              </h3>
              <TabelaDaLiga linhas={tabela.data ?? []} userId={userId} />
              {!encerrada && <LideresDaLiga linhas={tabela.data ?? []} />}
            </>
          ))}

        {situacao === "futura" && (
          <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            A liga começa dia {new Date(`${liga.data.inicio}T12:00:00`).toLocaleDateString("pt-BR")}
            .
          </p>
        )}

        {gestor && !encerrada && (
          <div className="flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="flex items-center gap-1.5 py-2 text-xs font-semibold text-primary"
            >
              <Pencil className="size-3.5" /> Editar liga
            </button>
            {situacao === "rolando" ? (
              <button
                type="button"
                onClick={() => setConfirmando("encerrar")}
                className="flex items-center gap-1.5 py-2 text-xs font-semibold text-destructive"
              >
                <Square className="size-3.5" /> Encerrar agora
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmando("apagar")}
                className="flex items-center gap-1.5 py-2 text-xs font-semibold text-destructive"
              >
                <Trash2 className="size-3.5" /> Apagar liga
              </button>
            )}
          </div>
        )}
      </main>

      {editando && crewId && (
        <FolhaLiga crewId={crewId} liga={liga.data} onFechar={() => setEditando(false)} />
      )}

      {confirmando && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55"
          onClick={(e) => {
            if (e.target === e.currentTarget && !ocupado) setConfirmando(null);
          }}
        >
          <div
            role="dialog"
            aria-label={confirmando === "encerrar" ? "Encerrar liga" : "Apagar liga"}
            className="w-full max-w-[480px] space-y-3 rounded-t-3xl bg-card p-4 pb-6"
          >
            <h2 className="text-lg font-extrabold text-foreground">
              {confirmando === "encerrar" ? "Encerrar a liga agora?" : "Apagar a liga?"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {confirmando === "encerrar"
                ? "Vale a tabela de hoje: saem o campeão e os prêmios, e a turma recebe o aviso. Não dá pra desfazer."
                : "Ela ainda não começou, então some sem deixar nada."}
            </p>
            <Button
              variant="destructive"
              className="w-full"
              disabled={ocupado}
              onClick={() => void executar(confirmando)}
            >
              {ocupado ? "..." : confirmando === "encerrar" ? "Encerrar liga" : "Apagar liga"}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={ocupado}
              onClick={() => setConfirmando(null)}
            >
              Voltar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
