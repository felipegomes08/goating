import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BuscaJogador } from "@/components/goating/busca-jogador";
import { JogadorItem, type JogadorResumo } from "@/components/goating/jogador-item";
import { Skeleton } from "@/components/ui/skeleton";

const CAMPOS =
  "id, nome_exibicao, handle, posicao_preferida, vezes_mvp, cidade, foto_url, overall, peladas_jogadas, xp, tier_reconhecido, avaliacoes_recebidas";

/** De onde vem cada sugestão, da mais próxima pra mais distante. */
const MOTIVOS = [
  { id: "turma", titulo: "Da sua turma" },
  { id: "pelada", titulo: "Jogaram com você" },
  { id: "cidade", titulo: "Da sua cidade" },
] as const;
type Motivo = (typeof MOTIVOS)[number]["id"];

const MAX_SUGESTOES = 15;

/**
 * Os jogadores que a pessoa segue e sugestões de quem seguir: primeiro quem é das
 * turmas dela, depois quem jogou as mesmas peladas, por fim os melhores da cidade.
 */
export function RedeDeJogadores({ userId, cidade }: { userId: string; cidade: string | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ocupados, setOcupados] = useState<Set<string>>(new Set());

  const rede = useQuery({
    queryKey: ["rede-jogadores", userId, cidade],
    queryFn: async () => {
      const [seguidosRes, seguidoresRes, minhasTurmasRes, minhasPeladasRes] = await Promise.all([
        supabase.from("followers").select("seguido_id").eq("seguidor_id", userId),
        supabase
          .from("followers")
          .select("id", { count: "exact", head: true })
          .eq("seguido_id", userId),
        supabase.from("crew_members").select("crew_id").eq("user_id", userId),
        supabase
          .from("match_participants")
          .select("match_id")
          .eq("user_id", userId)
          .eq("status", "aprovado")
          .order("entrou_em", { ascending: false })
          .limit(30),
      ]);
      if (seguidosRes.error) throw seguidosRes.error;
      const seguidos = (seguidosRes.data ?? []).map((s) => s.seguido_id);
      const turmas = (minhasTurmasRes.data ?? []).map((t) => t.crew_id);
      const peladas = (minhasPeladasRes.data ?? []).map((p) => p.match_id);

      const [daTurmaRes, daPeladaRes, daCidadeRes] = await Promise.all([
        turmas.length
          ? supabase
              .from("crew_members")
              .select("user_id")
              .in("crew_id", turmas)
              .is("removido_em", null)
              .not("user_id", "is", null)
          : Promise.resolve({ data: [] as { user_id: string | null }[] }),
        peladas.length
          ? supabase
              .from("match_participants")
              .select("user_id")
              .in("match_id", peladas)
              .eq("status", "aprovado")
          : Promise.resolve({ data: [] as { user_id: string }[] }),
        cidade
          ? supabase
              .from("profiles")
              .select("id")
              .eq("cidade", cidade)
              .eq("eh_convidado", false)
              .order("overall", { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [] as { id: string }[] }),
      ]);

      // cada pessoa entra uma vez só, com o motivo mais próximo
      const motivoDe = new Map<string, Motivo>();
      const jaSigo = new Set(seguidos);
      const candidatos: [string | null, Motivo][] = [
        ...(daTurmaRes.data ?? []).map((m): [string | null, Motivo] => [m.user_id, "turma"]),
        ...(daPeladaRes.data ?? []).map((m): [string | null, Motivo] => [m.user_id, "pelada"]),
        ...(daCidadeRes.data ?? []).map((m): [string | null, Motivo] => [m.id, "cidade"]),
      ];
      for (const [id, motivo] of candidatos) {
        if (!id || id === userId || jaSigo.has(id) || motivoDe.has(id)) continue;
        if (motivoDe.size >= MAX_SUGESTOES) break;
        motivoDe.set(id, motivo);
      }

      const ids = [...seguidos, ...motivoDe.keys()];
      const { data: perfis, error } = ids.length
        ? await supabase
            .from("profiles")
            .select(CAMPOS)
            .in("id", ids)
            .eq("eh_convidado", false)
            .order("overall", { ascending: false })
        : { data: [], error: null };
      if (error) throw error;
      const todos = (perfis ?? []) as JogadorResumo[];

      return {
        seguindo: todos.filter((p) => jaSigo.has(p.id)),
        sugestoes: MOTIVOS.map((m) => ({
          ...m,
          jogadores: todos.filter((p) => motivoDe.get(p.id) === m.id),
        })).filter((g) => g.jogadores.length > 0),
        seguidores: seguidoresRes.count ?? 0,
      };
    },
  });

  async function alternarSeguir(alvo: JogadorResumo, jaSegue: boolean) {
    setOcupados((s) => new Set(s).add(alvo.id));
    const { error } = jaSegue
      ? await supabase
          .from("followers")
          .delete()
          .eq("seguidor_id", userId)
          .eq("seguido_id", alvo.id)
      : await supabase.from("followers").insert({ seguidor_id: userId, seguido_id: alvo.id });
    if (error) {
      toast.error(
        /[áéíóúãõç]/i.test(error.message)
          ? error.message
          : jaSegue
            ? "Não deu pra deixar de seguir agora."
            : "Não deu pra seguir agora.",
      );
    } else {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rede-jogadores", userId] }),
        queryClient.invalidateQueries({ queryKey: ["meus-seguidos", userId] }),
        queryClient.invalidateQueries({ queryKey: ["seguidores", userId] }),
        queryClient.invalidateQueries({ queryKey: ["rede", userId] }),
        queryClient.invalidateQueries({ queryKey: ["ranking"] }),
      ]);
    }
    setOcupados((s) => {
      const novo = new Set(s);
      novo.delete(alvo.id);
      return novo;
    });
  }

  const linha = (j: JogadorResumo, seguindo: boolean) => (
    <JogadorItem
      key={j.id}
      jogador={j}
      seguindo={seguindo}
      ocupado={ocupados.has(j.id)}
      onAlternarSeguir={() => void alternarSeguir(j, seguindo)}
    />
  );

  return (
    <>
      <div className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
        <BuscaJogador
          ignorar={[userId]}
          rotuloAcao="Ver perfil"
          onEscolher={(p) => void navigate({ to: "/jogador/$id", params: { id: p.id } })}
        />
      </div>

      {rede.isLoading ? (
        [0, 1, 2].map((i) => <Skeleton key={i} className="h-[72px] w-full rounded-3xl" />)
      ) : rede.isError || !rede.data ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Não conseguimos carregar os jogadores.
        </p>
      ) : (
        <>
          <Link
            to="/rede"
            search={{ aba: "seguidores" }}
            className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 text-sm shadow-[var(--shadow-card)] active:opacity-60"
          >
            <Users className="size-4 text-primary" />
            <span className="flex-1 text-muted-foreground">
              <span className="font-bold text-foreground">{rede.data.seguidores}</span>{" "}
              {rede.data.seguidores === 1 ? "pessoa segue você" : "pessoas seguem você"}
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>

          <Grupo titulo={`Seguindo (${rede.data.seguindo.length})`}>
            {rede.data.seguindo.length === 0 ? (
              <p className="rounded-2xl bg-card p-5 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
                Você ainda não segue ninguém. Comece pelas sugestões aí embaixo.
              </p>
            ) : (
              rede.data.seguindo.map((j) => linha(j, true))
            )}
          </Grupo>

          {rede.data.sugestoes.length > 0 && (
            <>
              <p className="px-1 pt-2 text-sm font-extrabold text-foreground">
                Sugestões pra seguir
              </p>
              {rede.data.sugestoes.map((g) => (
                <Grupo key={g.id} titulo={g.titulo}>
                  {g.jogadores.map((j) => linha(j, false))}
                </Grupo>
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
        {titulo}
      </h2>
      {children}
    </section>
  );
}
