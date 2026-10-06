import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ESTRELAS_PADRAO, estrelasDoOverall } from "./sorteio";

export type Pelada = Tables<"matches">;
export type Membro = Tables<"crew_members">;

export type JogadorDoDia = {
  memberId: string;
  userId: string | null;
  nome: string;
  posicao: string | null;
  estrelas: number;
  time: number | null;
};

type PerfilResumo = {
  id: string;
  nome_exibicao: string;
  posicao_preferida: string | null;
  overall: number | string | null;
  avaliacoes_recebidas: number;
};

function paraJogador(
  membro: Membro,
  perfil: PerfilResumo | undefined,
  time: number | null,
): JogadorDoDia {
  return {
    memberId: membro.id,
    userId: membro.user_id,
    nome: membro.nome,
    posicao: membro.posicao ?? perfil?.posicao_preferida ?? null,
    estrelas:
      membro.estrelas ??
      estrelasDoOverall(perfil?.overall, perfil?.avaliacoes_recebidas) ??
      ESTRELAS_PADRAO,
    time,
  };
}

/** Organizador da pelada, ou dono/administrador da turma dela. */
export async function podeGerirPelada(
  pelada: Pick<Pelada, "id" | "organizador_id">,
  userId: string,
) {
  if (pelada.organizador_id === userId) return true;
  const { data } = await supabase.rpc("gere_pelada", { p_match_id: pelada.id });
  return data === true;
}

/** Pelada antiga (sem turma) ganha uma turma com o nome dela na primeira vez que monta os times. */
async function garantirTurma(pelada: Pelada) {
  if (pelada.crew_id) return pelada.crew_id;
  const { data: turma, error } = await supabase
    .from("crews")
    .insert({ dono_id: pelada.organizador_id, nome: pelada.titulo })
    .select("id")
    .single();
  if (error) throw error;
  const { error: erroVinculo } = await supabase
    .from("matches")
    .update({ crew_id: turma.id })
    .eq("id", pelada.id);
  if (erroVinculo) throw erroVinculo;
  return turma.id;
}

/**
 * Tudo que a tela de times precisa. Na primeira visita já traz os confirmados
 * da pelada pro elenco do dia.
 */
export async function prepararTimes(matchId: string, userId: string) {
  const { data: pelada, error } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  if (!pelada) return null;
  if (!(await podeGerirPelada(pelada, userId))) return { pelada, souOrganizador: false as const };

  const crewId = await garantirTurma(pelada);

  const [membrosRes, confirmadosRes, elencoRes] = await Promise.all([
    supabase.from("crew_members").select("*").eq("crew_id", crewId),
    supabase
      .from("match_participants")
      .select("user_id")
      .eq("match_id", matchId)
      .eq("status", "aprovado"),
    supabase.from("match_players").select("member_id, time").eq("match_id", matchId),
  ]);
  if (membrosRes.error) throw membrosRes.error;
  if (confirmadosRes.error) throw confirmadosRes.error;
  if (elencoRes.error) throw elencoRes.error;

  let membros = membrosRes.data;
  let elenco = elencoRes.data;
  const confirmados = confirmadosRes.data.map((c) => c.user_id);

  const idsPerfis = [
    ...new Set([...confirmados, ...membros.flatMap((m) => (m.user_id ? [m.user_id] : []))]),
  ];
  const { data: perfis } = idsPerfis.length
    ? await supabase
        .from("profiles")
        .select("id, nome_exibicao, posicao_preferida, overall, avaliacoes_recebidas")
        .in("id", idsPerfis)
    : { data: [] as PerfilResumo[] };
  const perfilDe = (id: string | null) => (perfis ?? []).find((p) => p.id === id);

  // Confirmado que ainda não é da turma entra nela.
  const novos = confirmados.filter((uid) => !membros.some((m) => m.user_id === uid));
  if (novos.length > 0) {
    const { data: criados, error: erroMembros } = await supabase
      .from("crew_members")
      .insert(
        novos.map((uid) => ({
          crew_id: crewId,
          user_id: uid,
          nome: perfilDe(uid)?.nome_exibicao ?? "Jogador",
        })),
      )
      .select("*");
    if (erroMembros) throw erroMembros;
    membros = [...membros, ...criados];
  }

  const membrosConfirmados = membros.filter((m) => m.user_id && confirmados.includes(m.user_id));
  if (elenco.length === 0 && membrosConfirmados.length > 0) {
    const linhas = membrosConfirmados.map((m) => ({ match_id: matchId, member_id: m.id }));
    const { error: erroElenco } = await supabase.from("match_players").insert(linhas);
    if (erroElenco) throw erroElenco;
    elenco = linhas.map((l) => ({ member_id: l.member_id, time: null }));
  }

  const jogadores = elenco.flatMap((linha) => {
    const membro = membros.find((m) => m.id === linha.member_id);
    return membro ? [paraJogador(membro, perfilDe(membro.user_id), linha.time)] : [];
  });
  const confirmadosFora = membrosConfirmados
    .filter((m) => !elenco.some((l) => l.member_id === m.id))
    .map((m) => paraJogador(m, perfilDe(m.user_id), null));

  return {
    pelada: { ...pelada, crew_id: crewId },
    souOrganizador: true as const,
    membros,
    jogadores,
    confirmadosFora,
  };
}

/** Elenco do dia com nome, pra tela do placar e do resumo. */
export async function carregarElenco(matchId: string) {
  const { data, error } = await supabase
    .from("match_players")
    .select(
      "member_id, time, gols, jogos, vitorias, empates, derrotas, crew_members(nome, user_id)",
    )
    .eq("match_id", matchId);
  if (error) throw error;
  return data.map((l) => ({
    memberId: l.member_id,
    time: l.time,
    gols: l.gols,
    jogos: l.jogos,
    vitorias: l.vitorias,
    empates: l.empates,
    derrotas: l.derrotas,
    nome: l.crew_members?.nome ?? "Jogador",
    userId: l.crew_members?.user_id ?? null,
  }));
}

export type LinhaElenco = Awaited<ReturnType<typeof carregarElenco>>[number];

export function textoDosTimes(titulo: string, nomes: string[], times: { nome: string }[][]) {
  const blocos = times
    .map((jogadores, i) =>
      jogadores.length
        ? `*${nomes[i] ?? `Time ${i + 1}`}*\n${jogadores.map((j) => `• ${j.nome}`).join("\n")}`
        : "",
    )
    .filter(Boolean);
  return `⚽ ${titulo}\n\n${blocos.join("\n\n")}`;
}

export async function compartilhar(texto: string) {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text: texto });
      return "compartilhado" as const;
    } catch (erro) {
      if (erro instanceof DOMException && erro.name === "AbortError") return "cancelado" as const;
      // navegador recusou compartilhar: cai pro copiar
    }
  }
  await navigator.clipboard.writeText(texto);
  return "copiado" as const;
}
