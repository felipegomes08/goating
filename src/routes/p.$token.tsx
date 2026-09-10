import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { GoatingLogo } from "@/components/goating/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/p/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Convite para uma pelada · Goating" },
      {
        name: "description",
        content: "Você foi convidado para uma pelada. Entre no Goating e confirme sua presença.",
      },
      { property: "og:title", content: "Você foi chamado para uma pelada" },
      {
        property: "og:description",
        content: "Confirme sua presença no Goating e evolua sua cartinha de jogador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Convite,
});

function Convite() {
  const { token } = useParams({ from: "/p/$token" });
  const { userId, carregando } = useSession();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (carregando) return;
    let cancelado = false;

    (async () => {
      const { data: convite } = await supabase
        .from("match_invite_links")
        .select("match_id")
        .eq("token", token)
        .eq("ativo", true)
        .maybeSingle();

      if (cancelado) return;
      if (!convite) {
        setErro("Esse link de convite não é mais válido.");
        return;
      }
      if (!userId) {
        navigate({ to: "/auth", search: { convite: token }, replace: true });
        return;
      }
      navigate({ to: "/pelada/$id", params: { id: convite.match_id }, replace: true });
    })();

    return () => {
      cancelado = true;
    };
  }, [token, userId, carregando, navigate]);

  return (
    <div className="app-shell flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <GoatingLogo withWordmark />
      {erro ? (
        <>
          <p className="text-sm text-muted-foreground">{erro}</p>
          <Button asChild>
            <Link to="/">Ver peladas no feed</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Abrindo o convite…</p>
          <Skeleton className="h-24 w-full max-w-xs rounded-2xl" />
        </>
      )}
    </div>
  );
}
