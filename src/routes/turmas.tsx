import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronRight, Crown, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePerfil } from "@/hooks/use-session";
import { minhaSituacao, useMinhasTurmas } from "@/hooks/use-turmas";
import { BottomNav } from "@/components/goating/bottom-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/turmas")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Minhas turmas · Goating" },
      {
        name: "description",
        content: "As turmas do seu futebol: placar, artilharia e ranking da galera.",
      },
    ],
  }),
  component: MinhasTurmas,
});

function MinhasTurmas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId, carregando } = useSession();
  const { data: perfil } = usePerfil(userId);
  const turmas = useMinhasTurmas(userId);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!carregando && !userId) navigate({ to: "/auth", replace: true });
  }, [carregando, userId, navigate]);

  async function criarTurma() {
    if (!userId || !nome.trim()) return;
    setOcupado(true);
    try {
      const { data: turma, error } = await supabase
        .from("crews")
        .insert({ dono_id: userId, nome: nome.trim() })
        .select("id")
        .single();
      if (error) throw error;
      // o dono já entra como jogador da própria turma
      const { error: erroMembro } = await supabase
        .from("crew_members")
        .insert({ crew_id: turma.id, user_id: userId, nome: perfil?.nome_exibicao ?? "Eu" });
      if (erroMembro) throw erroMembro;
      await queryClient.invalidateQueries({ queryKey: ["minhas-turmas-resumo"] });
      await queryClient.invalidateQueries({ queryKey: ["minhas-turmas"] });
      await navigate({ to: "/turma/$id", params: { id: turma.id }, search: { aba: "membros" } });
    } catch {
      toast.error("Não deu pra criar a turma. Confere a internet.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-primary px-4 pt-5 pb-4">
        <h1 className="text-xl font-extrabold text-primary-foreground">Minhas turmas</h1>
        <p className="mt-1 text-xs text-mint">O futebol fixo da galera, com placar e ranking.</p>
      </header>

      <main className="flex-1 space-y-3 px-4 py-4">
        {criando ? (
          <div className="space-y-2 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
            <p className="text-sm font-bold text-foreground">Nome da turma</p>
            <Input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void criarTurma();
              }}
              placeholder="Pelada de quinta"
            />
            <p className="text-xs text-muted-foreground">
              Depois é só chamar a galera pelo link e criar as peladas dentro dela.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCriando(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" disabled={ocupado || !nome.trim()} onClick={criarTurma}>
                Criar turma
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="w-full bg-mint font-semibold text-mint-foreground hover:bg-mint/90"
            onClick={() => setCriando(true)}
          >
            <Plus className="mr-2 size-4" /> Criar turma
          </Button>
        )}

        {carregando || turmas.isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
        ) : turmas.isError ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Não conseguimos carregar suas turmas.
          </p>
        ) : (turmas.data ?? []).length === 0 ? (
          <div className="mt-10 space-y-2 text-center">
            <Users className="mx-auto size-10 text-muted-foreground" />
            <p className="text-base font-semibold text-foreground">
              Você ainda não está em nenhuma turma
            </p>
            <p className="text-sm text-muted-foreground">
              Crie a do seu futebol, ou peça o link da turma pra quem organiza.
            </p>
          </div>
        ) : (
          (turmas.data ?? []).map((t) => (
            <Link
              key={t.crew_id}
              to="/turma/$id"
              params={{ id: t.crew_id }}
              className="block rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-base font-extrabold text-foreground">
                    <span className="truncate">{t.nome}</span>
                    {(t.sou_dono || t.sou_admin) && (
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {t.sou_dono ? "DONO" : "ADMIN"}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.membros} {t.membros === 1 ? "jogador" : "jogadores"} · {t.peladas}{" "}
                    {t.peladas === 1 ? "pelada" : "peladas"} com placar
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </div>

              <p className="mt-3 text-sm font-bold text-primary">{minhaSituacao(t)}</p>
              {t.artilheiro && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground">
                  <Crown className="size-3.5 text-tier-ouro" />
                  Artilheiro do mês: {t.artilheiro} ({t.artilheiro_gols})
                </p>
              )}
              {t.proxima_data && t.proxima_horario && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  Próxima:{" "}
                  {new Date(`${t.proxima_data}T12:00:00`).toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                  })}{" "}
                  às {t.proxima_horario.slice(0, 5)}
                </p>
              )}
            </Link>
          ))
        )}
      </main>

      <BottomNav />
    </div>
  );
}
