import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, usePerfil } from "@/hooks/use-session";
import { useMinhasTurmas } from "@/hooks/use-turmas";
import { useChatsNaoLidos } from "@/hooks/use-chat";
import { BottomNav } from "@/components/goating/bottom-nav";
import { Sino } from "@/components/goating/sino";
import { PuxarParaAtualizar } from "@/components/goating/puxar-para-atualizar";
import { CartaoTurma } from "@/components/goating/cartao-turma";
import { RedeDeJogadores } from "@/components/goating/rede-de-jogadores";
import { Segmentos, TituloGrande, classeSegmento } from "@/components/goating/titulo-grande";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/turmas")({
  ssr: false,
  // a mesma tela mostra as turmas (padrão) ou os jogadores que a pessoa segue
  validateSearch: (search: Record<string, unknown>): { ver?: "jogadores" | undefined } => ({
    ver: search["ver"] === "jogadores" ? "jogadores" : undefined,
  }),
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
  const { ver } = useSearch({ from: "/turmas" });
  const vendoJogadores = ver === "jogadores";
  const { userId, carregando } = useSession();
  const { data: perfil } = usePerfil(userId);
  const turmas = useMinhasTurmas(userId);
  const chats = useChatsNaoLidos(userId);
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
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-background">
      <TituloGrande
        titulo={vendoJogadores ? "Jogadores" : "Turmas"}
        subtitulo={
          vendoJogadores
            ? "Quem você segue e quem vale a pena seguir."
            : "O futebol fixo da galera, com placar e ranking."
        }
        acao={
          <span className="flex shrink-0 items-center gap-2">
            {!criando && !vendoJogadores && (
              <Button size="sm" className="shrink-0" onClick={() => setCriando(true)}>
                <Plus /> Criar
              </Button>
            )}
            <Sino />
          </span>
        }
      >
        <Segmentos colunas={2}>
          <Link to="/turmas" replace className={classeSegmento(!vendoJogadores)}>
            Turmas
          </Link>
          <Link
            to="/turmas"
            search={{ ver: "jogadores" }}
            replace
            className={classeSegmento(vendoJogadores)}
          >
            Jogadores
          </Link>
        </Segmentos>
      </TituloGrande>

      <main className="flex-1 space-y-3 px-4 py-4">
        {vendoJogadores ? (
          userId ? (
            <RedeDeJogadores userId={userId} cidade={perfil?.cidade ?? null} />
          ) : null
        ) : (
          listaDeTurmas()
        )}
      </main>

      <PuxarParaAtualizar />
      <BottomNav />
    </div>
  );

  // chamada como função, não como componente: assim o campo de criar turma não perde o foco a cada tecla
  function listaDeTurmas() {
    return (
      <>
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
        ) : null}

        {carregando || turmas.isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-32 w-full rounded-3xl" />)
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
            <CartaoTurma
              key={t.crew_id}
              turma={t}
              naoLidas={chats.silenciado(t.crew_id) ? 0 : chats.naoLidas(t.crew_id)}
            />
          ))
        )}
      </>
    );
  }
}
