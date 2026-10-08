import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  avaliouTodos,
  estaPendenteAvaliacao,
  type PeladaFeed,
} from "@/components/goating/match-card";

/** Quantos dias pra frente as peladas abertas da cidade aparecem no feed. */
export const DIAS_NO_FEED = 7;

/** Quantas peladas finalizadas (as mais recentes) a aba "Finalizadas" carrega. */
const FINALIZADAS_NO_FEED = 20;

/** Data no fuso do aparelho (AAAA-MM-DD). toISOString usaria UTC e viraria o dia às 21h no Brasil. */
export function dataLocal(daquiADias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daquiADias);
  return d.toLocaleDateString("sv-SE");
}

const CAMPOS =
  "id, titulo, data, horario, horario_fim, local, cidade, quantidade_vagas, tipo, status, organizador_id, mvp_id, finalizada_em, crew_id";

type Linha = {
  id: string;
  titulo: string;
  data: string;
  horario: string;
  horario_fim: string | null;
  local: string;
  cidade: string;
  quantidade_vagas: number;
  tipo: string;
  status: string;
  organizador_id: string;
  mvp_id: string | null;
  finalizada_em: string | null;
  crew_id: string | null;
};

/**
 * Pelada recorrente vira uma só: fica a próxima data de cada série
 * (mesmo organizador, turma, título e horário). A lista precisa vir em ordem de data.
 */
function soProximaDeCadaSerie(peladas: PeladaFeed[]) {
  const vistas = new Set<string>();
  return peladas.filter((p) => {
    const serie = [
      p.organizador_id,
      p.crew_id ?? "",
      p.titulo.trim().toLowerCase(),
      p.horario,
    ].join("|");
    if (vistas.has(serie)) return false;
    vistas.add(serie);
    return true;
  });
}

const porData = (a: PeladaFeed, b: PeladaFeed) =>
  `${a.data}${a.horario}`.localeCompare(`${b.data}${b.horario}`);

/**
 * Tudo que o feed mostra, numa consulta só:
 * - próximas: as minhas (organizo ou confirmei) + as abertas da minha cidade na semana;
 * - finalizadas: só as minhas, com as que ainda esperam minha avaliação primeiro.
 */
export function useFeed(userId: string | null, cidade: string | null) {
  return useQuery({
    queryKey: ["feed", userId, cidade],
    enabled: !!userId,
    queryFn: async () => {
      const hoje = dataLocal();

      const { data: vinculos, error: erroVinculos } = await supabase
        .from("match_participants")
        .select("match_id, matches!inner(status, data)")
        .eq("user_id", userId!)
        .in("status", ["aprovado", "pendente"]);
      if (erroVinculos) throw erroVinculos;
      // quem joga há muito tempo tem centenas de peladas: das finalizadas só as últimas interessam
      const meus = (vinculos ?? []) as unknown as {
        match_id: string;
        matches: { status: string; data: string };
      }[];
      const idsAbertas = meus
        .filter((v) => v.matches.status !== "finalizada")
        .map((v) => v.match_id);
      const idsFinalizadas = meus
        .filter((v) => v.matches.status === "finalizada")
        .sort((a, b) => b.matches.data.localeCompare(a.matches.data))
        .slice(0, FINALIZADAS_NO_FEED)
        .map((v) => v.match_id);
      const filtroMinhas = (ids: string[]) =>
        ids.length > 0
          ? `organizador_id.eq.${userId},id.in.(${ids.join(",")})`
          : `organizador_id.eq.${userId}`;

      const [abertasRes, finalizadasRes, cidadeRes] = await Promise.all([
        supabase
          .from("matches")
          .select(CAMPOS)
          .neq("status", "finalizada")
          .or(filtroMinhas(idsAbertas)),
        supabase
          .from("matches")
          .select(CAMPOS)
          .eq("status", "finalizada")
          .or(filtroMinhas(idsFinalizadas))
          .order("data", { ascending: false })
          .limit(FINALIZADAS_NO_FEED),
        cidade
          ? supabase
              .from("matches")
              .select(CAMPOS)
              .eq("status", "agendada")
              .eq("cidade", cidade)
              .gte("data", hoje)
              .lte("data", dataLocal(DIAS_NO_FEED))
              .order("data")
              .limit(100)
          : Promise.resolve({ data: [] as Linha[], error: null }),
      ]);
      if (abertasRes.error) throw abertasRes.error;
      if (finalizadasRes.error) throw finalizadasRes.error;
      if (cidadeRes.error) throw cidadeRes.error;
      const minhasRes = { data: [...(abertasRes.data ?? []), ...(finalizadasRes.data ?? [])] };

      const minhasIds = new Set((minhasRes.data ?? []).map((p) => p.id));
      const linhas = [
        ...(minhasRes.data ?? []),
        ...(cidadeRes.data ?? []).filter((p) => !minhasIds.has(p.id)),
      ] as Linha[];
      if (linhas.length === 0) return { proximas: [], finalizadas: [], aAvaliar: 0 };

      const ids = linhas.map((p) => p.id);
      const pessoas = [
        ...new Set(
          linhas.flatMap((p) => (p.mvp_id ? [p.organizador_id, p.mvp_id] : [p.organizador_id])),
        ),
      ];
      const turmasIds = [...new Set(linhas.flatMap((p) => (p.crew_id ? [p.crew_id] : [])))];
      const emAvaliacao = linhas.filter((p) => estaPendenteAvaliacao(p)).map((p) => p.id);

      const [{ data: participantes }, { data: perfis }, { data: turmas }, { data: avaliacoes }] =
        await Promise.all([
          supabase
            .from("match_participants")
            .select("match_id, user_id, status")
            .in("match_id", ids),
          supabase
            .from("profiles")
            .select("id, nome_exibicao, overall, tier_reconhecido")
            .in("id", pessoas),
          turmasIds.length
            ? supabase.from("crews").select("id, nome").in("id", turmasIds)
            : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
          emAvaliacao.length
            ? supabase
                .from("evaluations")
                .select("match_id, avaliado_id")
                .eq("avaliador_id", userId!)
                .in("match_id", emAvaliacao)
            : Promise.resolve({ data: [] as { match_id: string; avaliado_id: string }[] }),
        ]);

      const todas = linhas.map((p): PeladaFeed => {
        const doJogo = (participantes ?? []).filter((x) => x.match_id === p.id);
        const meu = doJogo.find((x) => x.user_id === userId);
        const org = (perfis ?? []).find((x) => x.id === p.organizador_id);
        const mvp = p.mvp_id ? (perfis ?? []).find((x) => x.id === p.mvp_id) : null;
        return {
          ...p,
          turma: (turmas ?? []).find((t) => t.id === p.crew_id)?.nome ?? null,
          souOrganizador: p.organizador_id === userId,
          confirmados: doJogo.filter((x) => x.status === "aprovado").length,
          organizador: org
            ? {
                nome_exibicao: org.nome_exibicao,
                overall: org.overall,
                tier_reconhecido: org.tier_reconhecido,
              }
            : null,
          mvp: mvp ? { nome_exibicao: mvp.nome_exibicao } : null,
          jaAvaliei: avaliouTodos(
            doJogo,
            (avaliacoes ?? []).filter((a) => a.match_id === p.id).map((a) => a.avaliado_id),
            userId!,
          ),
          minhaSituacao:
            meu?.status === "aprovado"
              ? "aprovado"
              : meu?.status === "pendente"
                ? "pendente"
                : "nenhuma",
        };
      });

      const proximas = soProximaDeCadaSerie(
        todas
          .filter((p) => p.status === "em_andamento" || (p.status === "agendada" && p.data >= hoje))
          .sort(porData),
      );

      const esperaMinhaNota = (p: PeladaFeed) =>
        estaPendenteAvaliacao(p) &&
        p.minhaSituacao === "aprovado" &&
        p.confirmados > 1 &&
        !p.jaAvaliei;
      const finalizadas = todas
        .filter((p) => p.status === "finalizada" && minhasIds.has(p.id))
        .sort((a, b) => Number(esperaMinhaNota(b)) - Number(esperaMinhaNota(a)) || porData(b, a))
        .slice(0, FINALIZADAS_NO_FEED);

      return { proximas, finalizadas, aAvaliar: finalizadas.filter(esperaMinhaNota).length };
    },
  });
}
