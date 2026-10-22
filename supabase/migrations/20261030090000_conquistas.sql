-- Conquistas: medalhas no perfil. Todo mundo ganha; duas são só de quem é Premium.
-- O catálogo é o mesmo de src/lib/conquistas.ts (código, nome, métrica e meta).

-- 1. MEDALHAS GANHAS
CREATE TABLE IF NOT EXISTS public.conquistas (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  ganha_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, codigo)
);
ALTER TABLE public.conquistas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conquistas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.conquistas TO authenticated;
GRANT ALL ON public.conquistas TO service_role;
DROP POLICY IF EXISTS conquistas_ler ON public.conquistas;
CREATE POLICY conquistas_ler ON public.conquistas FOR SELECT TO authenticated USING (true);

-- 2. CATÁLOGO: código, nome (pro aviso), métrica e meta
CREATE OR REPLACE FUNCTION public.catalogo_de_conquistas()
RETURNS TABLE (codigo TEXT, nome TEXT, metrica TEXT, meta INT)
LANGUAGE sql
IMMUTABLE
AS $$
  VALUES
    ('mvp_1', 'Primeiro MVP', 'mvps', 1),
    ('mvp_5', '5 MVPs', 'mvps', 5),
    ('mvp_10', '10 MVPs', 'mvps', 10),
    ('mvp_25', '25 MVPs', 'mvps', 25),
    ('gol_1', 'Primeiro gol', 'gols', 1),
    ('gols_10', '10 gols', 'gols', 10),
    ('gols_50', '50 gols', 'gols', 50),
    ('gols_100', '100 gols', 'gols', 100),
    ('hat_trick', 'Hat-trick', 'gols_numa_pelada', 3),
    ('mes_artilheiro', 'Mês artilheiro', 'gols_num_mes', 10),
    ('garcom_10', 'Garçom', 'assistencias', 10),
    ('garcom_50', 'Garçom de ouro', 'assistencias', 50),
    ('paredao_10', 'Paredão', 'defesas', 10),
    ('paredao_50', 'Muralha', 'defesas', 50),
    ('peladas_10', '10 peladas', 'peladas', 10),
    ('peladas_50', '50 peladas', 'peladas', 50),
    ('peladas_100', '100 peladas', 'peladas', 100),
    ('fiel', 'Fiel', 'semanas_seguidas', 4),
    ('rodado', 'Rodado', 'turmas', 3),
    ('vitorias_10', '10 vitórias', 'vitorias', 10),
    ('vitorias_50', '50 vitórias', 'vitorias', 50),
    ('tier_prata', 'Chegou no Prata', 'tier', 2),
    ('tier_ouro', 'Chegou no Ouro', 'tier', 3),
    ('tier_platina', 'Chegou no Platina', 'tier', 4),
    ('tier_lendario', 'Chegou no Lendário', 'tier', 5),
    ('tier_goat', 'Virou GOAT', 'tier', 6),
    ('avaliador', 'Olheiro', 'avaliacoes_dadas', 50),
    ('seguidores_10', 'Tem torcida', 'seguidores', 10),
    ('criou_turma', 'Fundou uma turma', 'turmas_criadas', 1),
    ('organizou_10', 'Organizador', 'peladas_organizadas', 10),
    ('apoiador', 'Apoiador', 'premium', 1),
    ('estiloso', 'Estiloso', 'estilo', 1)
$$;

-- 3. PROGRESSO DE CADA CONQUISTA (valor atual e meta)
CREATE OR REPLACE FUNCTION public.progresso_das_conquistas(p_user UUID)
RETURNS TABLE (codigo TEXT, valor INT, meta INT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH jogos AS (
    -- o que ele fez em cada pelada com placar, em todas as turmas
    SELECT mp.gols, mp.assistencias, mp.defesas, mp.vitorias, m.data, m.crew_id
    FROM public.match_players mp
    JOIN public.crew_members cm ON cm.id = mp.member_id
    JOIN public.matches m ON m.id = mp.match_id
    WHERE cm.user_id = p_user AND m.placar_finalizado_em IS NOT NULL AND mp.jogos > 0
  ), semanas AS (
    -- semanas em que jogou alguma pelada finalizada
    SELECT DISTINCT date_trunc('week', m.data)::date AS semana
    FROM public.match_participants mp
    JOIN public.matches m ON m.id = mp.match_id
    WHERE mp.user_id = p_user AND mp.status = 'aprovado' AND m.status = 'finalizada'
  ), sequencias AS (
    SELECT count(*) AS tamanho
    FROM (
      SELECT semana, semana - (row_number() OVER (ORDER BY semana) * 7)::int AS grupo
      FROM semanas
    ) s
    GROUP BY grupo
  ), p AS (
    SELECT * FROM public.profiles WHERE id = p_user
  ), metricas AS (
    SELECT * FROM (VALUES
      ('mvps', (SELECT vezes_mvp FROM p)),
      ('gols', (SELECT COALESCE(sum(gols), 0) FROM jogos)::int),
      ('gols_numa_pelada', (SELECT COALESCE(max(gols), 0) FROM jogos)),
      ('gols_num_mes', (
        SELECT COALESCE(max(total), 0)::int FROM (
          SELECT sum(gols) AS total FROM jogos GROUP BY date_trunc('month', data)
        ) x)),
      ('assistencias', (SELECT COALESCE(sum(assistencias), 0) FROM jogos)::int),
      ('defesas', (SELECT COALESCE(sum(defesas), 0) FROM jogos)::int),
      ('peladas', (SELECT peladas_jogadas FROM p)),
      ('semanas_seguidas', (SELECT COALESCE(max(tamanho), 0) FROM sequencias)::int),
      ('turmas', (SELECT count(DISTINCT crew_id) FROM jogos)::int),
      ('vitorias', (SELECT COALESCE(sum(vitorias), 0) FROM jogos)::int),
      ('tier', (
        SELECT CASE tier_reconhecido
          WHEN 'Bronze' THEN 1 WHEN 'Prata' THEN 2 WHEN 'Ouro' THEN 3
          WHEN 'Platina' THEN 4 WHEN 'Lendário' THEN 5 WHEN 'GOAT' THEN 6 ELSE 0 END
        FROM p)),
      ('avaliacoes_dadas', (
        SELECT count(*) FROM public.evaluations WHERE avaliador_id = p_user)::int),
      ('seguidores', (SELECT count(*) FROM public.followers WHERE seguido_id = p_user)::int),
      ('turmas_criadas', (SELECT count(*) FROM public.crews WHERE dono_id = p_user)::int),
      ('peladas_organizadas', (
        SELECT count(*) FROM public.matches
        WHERE organizador_id = p_user AND status = 'finalizada')::int),
      ('premium', (CASE WHEN public.eh_premium(p_user) THEN 1 ELSE 0 END)),
      ('estilo', (
        SELECT CASE WHEN public.eh_premium(p_user) AND moldura IS NOT NULL AND capa IS NOT NULL
          THEN 1 ELSE 0 END FROM p))
    ) v(metrica, valor)
  )
  SELECT c.codigo, COALESCE(m.valor, 0), c.meta
  FROM public.catalogo_de_conquistas() c
  LEFT JOIN metricas m ON m.metrica = c.metrica;
$$;
REVOKE ALL ON FUNCTION public.progresso_das_conquistas(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.progresso_das_conquistas(UUID) TO authenticated;

-- 4. GRAVA AS NOVAS E AVISA
CREATE OR REPLACE FUNCTION public.atualizar_conquistas(p_user UUID, p_avisar BOOLEAN DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nova RECORD;
BEGIN
  FOR nova IN
    INSERT INTO public.conquistas (user_id, codigo)
    SELECT p_user, pr.codigo
    FROM public.progresso_das_conquistas(p_user) pr
    WHERE pr.valor >= pr.meta
    ON CONFLICT (user_id, codigo) DO NOTHING
    RETURNING codigo
  LOOP
    IF p_avisar THEN
      PERFORM public.notificar(
        p_user,
        'conquista',
        'Conquista nova: ' || (SELECT c.nome FROM public.catalogo_de_conquistas() c WHERE c.codigo = nova.codigo) || ' 🏅',
        'Toque pra ver suas medalhas.',
        '/perfil#conquistas',
        'conquista-' || nova.codigo,
        true
      );
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.atualizar_conquistas(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- 5. ROTINA: a cada 10 minutos confere quem tem conta (são poucos jogadores; quando forem
--    milhares, filtrar por quem teve atividade recente)
CREATE OR REPLACE FUNCTION public.rodar_conquistas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jogador UUID;
BEGIN
  FOR jogador IN SELECT id FROM public.profiles WHERE NOT eh_convidado LOOP
    PERFORM public.atualizar_conquistas(jogador, true);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.rodar_conquistas() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('conquistas')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'conquistas');
SELECT cron.schedule('conquistas', '*/10 * * * *', 'SELECT public.rodar_conquistas();');

-- 6. PRIMEIRA CARGA, SEM AVISO: cada um recebe as medalhas que já merece em silêncio
DO $$
DECLARE
  jogador UUID;
BEGIN
  FOR jogador IN SELECT id FROM public.profiles WHERE NOT eh_convidado LOOP
    PERFORM public.atualizar_conquistas(jogador, false);
  END LOOP;
END;
$$;
