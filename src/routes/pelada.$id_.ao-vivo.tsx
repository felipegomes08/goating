import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useVoltar } from "@/hooks/use-voltar";
import { usePlacarAoVivo } from "@/hooks/use-placar-ao-vivo";
import { TelaAoVivo } from "@/components/goating/placar-ao-vivo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/pelada/$id_/ao-vivo")({
  ssr: false,
  head: () => ({ meta: [{ title: "Ao vivo · Goating" }] }),
  component: AoVivoDaPelada,
});

/** Placar ao vivo pra quem não está na quadra: só olhar, atualiza sozinho. */
function AoVivoDaPelada() {
  const { id } = useParams({ from: "/pelada/$id_/ao-vivo" });
  const { userId, carregando } = useSession();
  const navigate = useNavigate();
  const voltar = useVoltar(() => void navigate({ to: "/pelada/$id", params: { id } }));
  const consulta = usePlacarAoVivo(id, !!userId);
  const dados = consulta.data;

  return (
    <div className="app-shell flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 bg-primary px-4 py-3">
        <button type="button" aria-label="Voltar" onClick={voltar}>
          <ArrowLeft className="size-5 text-primary-foreground" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-extrabold text-primary-foreground">
          {dados?.titulo ?? "Ao vivo"}
        </h1>
      </header>
      <div className="space-y-4 p-4">
        {carregando || consulta.isLoading ? (
          <>
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </>
        ) : !userId ? (
          <Aviso texto="Entre na sua conta pra acompanhar o placar ao vivo." />
        ) : !dados ? (
          <Aviso texto="Essa pelada não existe mais." />
        ) : (
          <>
            <TelaAoVivo dados={dados} />
            <Button asChild variant="outline" className="w-full">
              <Link
                to={dados.status === "finalizada" ? "/pelada/$id/resumo" : "/pelada/$id"}
                params={{ id }}
              >
                {dados.status === "finalizada" ? "Ver o resumo da pelada" : "Ver a pelada"}
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
      {texto}
    </p>
  );
}
