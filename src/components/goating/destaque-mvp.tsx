import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAvatarUrl } from "@/hooks/use-avatar";
import { FolhaCartao } from "@/components/goating/folha-cartao";
import { Button } from "@/components/ui/button";
import { gerarCartaoMvp, type DadosDoMvp } from "@/lib/placar/cartao-mvp";
import { tierPorNome } from "@/lib/tiers";

/**
 * O MVP da pelada, depois que a janela de avaliação fechou: quem foi, e o cartão dele
 * pra mandar no grupo. Qualquer pessoa que vê a pelada pode compartilhar.
 */
export function DestaqueDoMvp({
  matchId,
  mvpId,
  pelada,
}: {
  matchId: string;
  mvpId: string;
  pelada: { titulo: string; data: string; crew_id: string | null; temPlacar: boolean };
}) {
  const [compartilhando, setCompartilhando] = useState(false);

  const consulta = useQuery({
    queryKey: ["mvp-da-partida", matchId, mvpId],
    queryFn: async () => {
      const [perfilRes, notaRes, placarRes, turmaRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "nome_exibicao, handle, posicao_preferida, overall, tier_reconhecido, foto_url, vezes_mvp",
          )
          .eq("id", mvpId)
          .maybeSingle(),
        supabase.rpc("mvp_da_partida", { p_match_id: matchId }),
        pelada.temPlacar
          ? supabase
              .from("match_players")
              .select("gols, jogos, vitorias, assistencias, defesas, crew_members(user_id)")
              .eq("match_id", matchId)
          : Promise.resolve({ data: [] }),
        pelada.crew_id
          ? supabase.from("crews").select("nome").eq("id", pelada.crew_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (perfilRes.error) throw perfilRes.error;
      if (!perfilRes.data) return null;
      const nota = (notaRes.data ?? []).find((n) => n.mvp_id === mvpId);
      return {
        perfil: perfilRes.data,
        nota: nota ? Number(nota.nota) : null,
        avaliacoes: nota?.avaliacoes ?? 0,
        // a linha do MVP no elenco do dia (o elenco é ligado ao jogador da turma, não à conta)
        placar: (placarRes.data ?? []).find((j) => j.crew_members?.user_id === mvpId) ?? null,
        turma: turmaRes.data?.nome ?? null,
      };
    },
  });

  const perfil = consulta.data?.perfil;
  const fotoUrl = useAvatarUrl(perfil?.foto_url);
  if (!consulta.data || !perfil) return null;

  const tier = tierPorNome(perfil.tier_reconhecido);
  const dados: DadosDoMvp = {
    nome: perfil.nome_exibicao,
    nick: perfil.handle,
    posicao: perfil.posicao_preferida,
    overall: Number(perfil.overall ?? 0),
    tier: tier?.nome ?? null,
    fotoUrl: fotoUrl ?? null,
    gols: consulta.data.placar?.gols ?? null,
    jogos: consulta.data.placar?.jogos ?? null,
    vitorias: consulta.data.placar?.vitorias ?? null,
    assistencias: consulta.data.placar?.assistencias ?? 0,
    defesas: consulta.data.placar?.defesas ?? 0,
    nota: consulta.data.nota,
    avaliacoes: consulta.data.avaliacoes,
    mvps: perfil.vezes_mvp,
    pelada: pelada.titulo,
    data: pelada.data,
    turma: consulta.data.turma,
  };
  // com foto no perfil, espera o endereço dela ficar pronto pra não gerar o cartão sem a foto
  const pronto = !perfil.foto_url || !!fotoUrl;

  return (
    <div className="rounded-2xl border border-tier-ouro/40 bg-tier-ouro/10 p-4">
      <Link to="/jogador/$id" params={{ id: mvpId }} className="flex items-center gap-3">
        {fotoUrl ? (
          <img src={fotoUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-tier-ouro/25">
            <Crown className="size-6 text-tier-ouro" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wide text-tier-ouro">
            <Crown className="size-3.5" /> MVP DA PARTIDA
          </p>
          <p className="truncate text-lg leading-tight font-extrabold text-foreground">
            {perfil.nome_exibicao}
          </p>
          {dados.nota !== null && (
            <p className="text-xs text-muted-foreground">
              Nota {dados.nota.toFixed(1).replace(".", ",")} na pelada
              {dados.gols ? ` · ${dados.gols} ${dados.gols === 1 ? "gol" : "gols"}` : ""}
            </p>
          )}
        </div>
      </Link>
      <Button
        className="mt-3 w-full bg-tier-ouro font-semibold text-primary hover:bg-tier-ouro/90"
        disabled={!pronto}
        onClick={() => setCompartilhando(true)}
      >
        <Share2 className="mr-2 size-4" /> Ver cartão do MVP
      </Button>

      {compartilhando && (
        <FolhaCartao
          gerar={() => gerarCartaoMvp(dados)}
          titulo="Cartão do MVP"
          nomeDoArquivo={`goating-mvp-${perfil.handle ?? "da-partida"}.png`}
          onFechar={() => setCompartilhando(false)}
        />
      )}
    </div>
  );
}
