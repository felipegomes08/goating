-- Ligas da turma: um período (ex.: 2 meses) com nome, descrição, pontos próprios e tabela.
--
-- A tabela é o crew_stats da turma entre o início e o fim, com os pontos da liga (o
-- organizador escolhe quanto vale vitória, empate, presença, gol e MVP; padrão 3/1/1/0/0).
-- Só dono/ADM com Premium cria; todo mundo da turma participa e vê de graça. Uma liga por vez
-- na turma (os períodos não se sobrepõem).
-- A cada pelada com placar encerrado dentro do período, a tabela vai pro chat (mensagem 'liga').
-- No fim, os prêmios (campeão, artilheiro, garçom, paredão, rei do MVP, mais presente) ficam
-- gravados e viram troféus no perfil.

CREATE TABLE public.ligas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES public.crews (id) ON DELETE CASCADE,
  nome text NOT NULL CHECK (char_length(btrim(nome)) BETWEEN 1 AND 60),
  descricao text CHECK (char_length(descricao) <= 500),
  inicio date NOT NULL,
  fim date NOT NULL,
  pts_vitoria smallint NOT NULL DEFAULT 3 CHECK (pts_vitoria BETWEEN 0 AND 10),
  pts_empate smallint NOT NULL DEFAULT 1 CHECK (pts_empate BETWEEN 0 AND 10),
  pts_presenca smallint NOT NULL DEFAULT 1 CHECK (pts_presenca BETWEEN 0 AND 10),
  pts_gol smallint NOT NULL DEFAULT 0 CHECK (pts_gol BETWEEN 0 AND 10),
  pts_mvp smallint NOT NULL DEFAULT 0 CHECK (pts_mvp BETWEEN 0 AND 10),
  criada_por uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  encerrada_em timestamptz,
  CHECK (fim >= inicio AND fim <= inicio + 366)
);
CREATE INDEX ligas_crew ON public.ligas (crew_id, inicio DESC);

CREATE TABLE public.premios_de_liga (
  liga_id uuid NOT NULL REFERENCES public.ligas (id) ON DELETE CASCADE,
  categoria text NOT NULL
    CHECK (categoria IN ('campeao', 'artilheiro', 'garcom', 'paredao', 'rei_mvp', 'mais_presente')),
  member_id uuid NOT NULL REFERENCES public.crew_members (id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  nome text NOT NULL,
  valor integer NOT NULL,
  PRIMARY KEY (liga_id, categoria, member_id)
);
CREATE INDEX premios_de_liga_user ON public.premios_de_liga (user_id);

ALTER TABLE public.ligas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premios_de_liga ENABLE ROW LEVEL SECURITY;
CREATE POLICY ligas_select_auth ON public.ligas FOR SELECT TO authenticated USING (true);
CREATE POLICY premios_de_liga_select_auth ON public.premios_de_liga
  FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.ligas FROM anon, authenticated;
REVOKE ALL ON public.premios_de_liga FROM anon, authenticated;
GRANT SELECT ON public.ligas TO authenticated;
GRANT SELECT ON public.premios_de_liga TO authenticated;

-- a tabela da liga: crew_stats no período, com os pontos da liga e a posição
CREATE OR REPLACE FUNCTION public.tabela_da_liga(p_liga_id uuid)
RETURNS TABLE(
  posicao integer, member_id uuid, user_id uuid, nome text, foto_url text, pontos integer,
  peladas integer, jogos integer, vitorias integer, empates integer, derrotas integer,
  gols integer, assistencias integer, defesas integer, mvps integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH l AS (SELECT * FROM public.ligas WHERE id = p_liga_id),
  s AS (
    SELECT st.*,
      (st.vitorias * l.pts_vitoria + st.empates * l.pts_empate + st.peladas * l.pts_presenca
       + st.gols * l.pts_gol + st.mvps * l.pts_mvp)::integer AS pts
    FROM l, LATERAL public.crew_stats(l.crew_id, l.inicio, l.fim) st
  )
  SELECT
    (rank() OVER (ORDER BY s.pts DESC, s.vitorias DESC, s.gols DESC, s.mvps DESC))::integer,
    s.member_id, s.user_id, s.nome, s.foto_url, s.pts,
    s.peladas::integer, s.jogos::integer, s.vitorias::integer, s.empates::integer,
    s.derrotas::integer, s.gols::integer, s.assistencias::integer, s.defesas::integer,
    s.mvps::integer
  FROM s
  ORDER BY s.pts DESC, s.vitorias DESC, s.gols DESC, s.mvps DESC, s.nome;
$$;

-- a liga da turma que pega uma data (pra rodada) ou que se sobrepõe a um período
CREATE OR REPLACE FUNCTION public.liga_sobreposta(p_crew_id uuid, p_inicio date, p_fim date, p_ignorar uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.ligas
  WHERE crew_id = p_crew_id AND id IS DISTINCT FROM p_ignorar
    AND daterange(inicio, fim, '[]') && daterange(p_inicio, p_fim, '[]')
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.liga_sobreposta(uuid, date, date, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.criar_liga(
  p_crew_id uuid, p_nome text, p_descricao text, p_inicio date, p_fim date,
  p_pts_vitoria smallint DEFAULT 3, p_pts_empate smallint DEFAULT 1,
  p_pts_presenca smallint DEFAULT 1, p_pts_gol smallint DEFAULT 0, p_pts_mvp smallint DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.gere_turma(p_crew_id) THEN
    RAISE EXCEPTION 'Só o dono ou um administrador da turma cria liga.';
  END IF;
  IF NOT public.eh_premium(auth.uid()) THEN
    RAISE EXCEPTION 'Criar liga é do Premium.';
  END IF;
  IF p_fim < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'O fim da liga já passou.';
  END IF;
  IF public.liga_sobreposta(p_crew_id, p_inicio, p_fim) IS NOT NULL THEN
    RAISE EXCEPTION 'Já tem uma liga nesse período. Uma liga por vez na turma.';
  END IF;
  INSERT INTO public.ligas (crew_id, nome, descricao, inicio, fim, pts_vitoria, pts_empate,
                            pts_presenca, pts_gol, pts_mvp, criada_por)
  VALUES (p_crew_id, btrim(p_nome), NULLIF(btrim(COALESCE(p_descricao, '')), ''), p_inicio, p_fim,
          p_pts_vitoria, p_pts_empate, p_pts_presenca, p_pts_gol, p_pts_mvp, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.editar_liga(
  p_liga_id uuid, p_nome text, p_descricao text, p_fim date,
  p_pts_vitoria smallint, p_pts_empate smallint, p_pts_presenca smallint,
  p_pts_gol smallint, p_pts_mvp smallint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l public.ligas;
BEGIN
  SELECT * INTO l FROM public.ligas WHERE id = p_liga_id;
  IF l.id IS NULL OR NOT public.gere_turma(l.crew_id) THEN
    RAISE EXCEPTION 'Só o dono ou um administrador da turma mexe na liga.';
  END IF;
  IF l.encerrada_em IS NOT NULL THEN
    RAISE EXCEPTION 'A liga já acabou.';
  END IF;
  IF p_fim < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'O fim da liga não pode ficar no passado. Pra acabar agora, use Encerrar.';
  END IF;
  IF public.liga_sobreposta(l.crew_id, l.inicio, p_fim, l.id) IS NOT NULL THEN
    RAISE EXCEPTION 'Esse fim encosta em outra liga da turma.';
  END IF;
  UPDATE public.ligas SET
    nome = btrim(p_nome),
    descricao = NULLIF(btrim(COALESCE(p_descricao, '')), ''),
    fim = p_fim,
    pts_vitoria = p_pts_vitoria, pts_empate = p_pts_empate, pts_presenca = p_pts_presenca,
    pts_gol = p_pts_gol, pts_mvp = p_pts_mvp
  WHERE id = p_liga_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apagar_liga(p_liga_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l public.ligas;
BEGIN
  SELECT * INTO l FROM public.ligas WHERE id = p_liga_id;
  IF l.id IS NULL OR NOT public.gere_turma(l.crew_id) THEN
    RAISE EXCEPTION 'Só o dono ou um administrador da turma mexe na liga.';
  END IF;
  IF l.inicio <= (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'A liga já começou. Dá pra encerrar, não apagar.';
  END IF;
  DELETE FROM public.ligas WHERE id = p_liga_id;
END;
$$;

-- fecha a liga: grava os prêmios, avisa a turma e manda o resultado pro chat
CREATE OR REPLACE FUNCTION public.fechar_liga(p_liga_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l public.ligas;
  v_turma text;
  v_campeoes text;
  u uuid;
BEGIN
  SELECT * INTO l FROM public.ligas WHERE id = p_liga_id FOR UPDATE;
  IF l.id IS NULL OR l.encerrada_em IS NOT NULL THEN
    RETURN;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _tabela_liga ON COMMIT DROP AS
    SELECT * FROM public.tabela_da_liga(p_liga_id) WITH NO DATA;
  DELETE FROM _tabela_liga;
  INSERT INTO _tabela_liga SELECT * FROM public.tabela_da_liga(p_liga_id);

  -- campeão: todo mundo empatado em 1º (mesmos pontos e desempates)
  INSERT INTO public.premios_de_liga (liga_id, categoria, member_id, user_id, nome, valor)
  SELECT p_liga_id, 'campeao', t.member_id, t.user_id, t.nome, t.pontos
  FROM _tabela_liga t WHERE t.posicao = 1 AND t.pontos > 0;

  -- as categorias: quem tem o maior número (empate = todos), só se for maior que zero
  INSERT INTO public.premios_de_liga (liga_id, categoria, member_id, user_id, nome, valor)
  SELECT p_liga_id, c.categoria, t.member_id, t.user_id, t.nome, c.valor
  FROM _tabela_liga t
  CROSS JOIN LATERAL (VALUES
    ('artilheiro', t.gols), ('garcom', t.assistencias), ('paredao', t.defesas),
    ('rei_mvp', t.mvps), ('mais_presente', t.peladas)
  ) AS c(categoria, valor)
  WHERE c.valor > 0
    AND c.valor = (SELECT max(CASE c.categoria
                     WHEN 'artilheiro' THEN x.gols WHEN 'garcom' THEN x.assistencias
                     WHEN 'paredao' THEN x.defesas WHEN 'rei_mvp' THEN x.mvps
                     ELSE x.peladas END) FROM _tabela_liga x)
  ON CONFLICT DO NOTHING;

  UPDATE public.ligas SET encerrada_em = now() WHERE id = p_liga_id;

  SELECT nome INTO v_turma FROM public.crews WHERE id = l.crew_id;
  SELECT string_agg(split_part(nome, ' ', 1), ' e ' ORDER BY nome) INTO v_campeoes
  FROM public.premios_de_liga WHERE liga_id = p_liga_id AND categoria = 'campeao';

  FOR u IN
    SELECT cm.user_id FROM public.crew_members cm
    WHERE cm.crew_id = l.crew_id AND cm.user_id IS NOT NULL AND cm.removido_em IS NULL
  LOOP
    PERFORM public.notificar(u, 'liga',
      '🏆 ' || l.nome || ' acabou',
      CASE WHEN v_campeoes IS NULL THEN 'Veja a tabela final e os premiados.'
           ELSE v_campeoes || ' é o campeão. Veja a tabela final e os premiados.' END,
      '/liga/' || l.id, 'liga-fim:' || l.id, true);
  END LOOP;

  INSERT INTO public.mensagens_da_turma (crew_id, autor_id, tipo, match_id, dados)
  VALUES (l.crew_id, NULL, 'liga', NULL,
          jsonb_build_object('evento', 'fim', 'liga_id', l.id, 'liga', l.nome,
                             'lider', v_campeoes));

  -- o aviso no celular vai pelo chat: o do sino fica sem push pra quem recebe o do chat
  UPDATE public.notificacoes n SET push_enviado_em = now()
  WHERE n.chave = 'liga-fim:' || l.id AND n.push_enviado_em IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.chat_da_turma_leitura cl
      WHERE cl.crew_id = l.crew_id AND cl.user_id = n.user_id AND cl.silenciado
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = n.user_id AND 'chat' = ANY (COALESCE(p.push_desligados, '{}'))
    );
END;
$$;
REVOKE ALL ON FUNCTION public.fechar_liga(uuid) FROM PUBLIC, anon, authenticated;

-- o gestor encerra a liga antes do fim (vale a tabela de hoje)
CREATE OR REPLACE FUNCTION public.encerrar_liga(p_liga_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l public.ligas;
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT * INTO l FROM public.ligas WHERE id = p_liga_id;
  IF l.id IS NULL OR NOT public.gere_turma(l.crew_id) THEN
    RAISE EXCEPTION 'Só o dono ou um administrador da turma mexe na liga.';
  END IF;
  IF l.encerrada_em IS NOT NULL THEN
    RAISE EXCEPTION 'A liga já acabou.';
  END IF;
  IF l.inicio > hoje THEN
    RAISE EXCEPTION 'A liga nem começou. Dá pra apagar.';
  END IF;
  UPDATE public.ligas SET fim = LEAST(fim, hoje) WHERE id = p_liga_id;
  PERFORM public.fechar_liga(p_liga_id);
END;
$$;

REVOKE ALL ON FUNCTION public.criar_liga(uuid, text, text, date, date, smallint, smallint, smallint, smallint, smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.editar_liga(uuid, text, text, date, smallint, smallint, smallint, smallint, smallint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apagar_liga(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.encerrar_liga(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tabela_da_liga(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_liga(uuid, text, text, date, date, smallint, smallint, smallint, smallint, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_liga(uuid, text, text, date, smallint, smallint, smallint, smallint, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apagar_liga(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encerrar_liga(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tabela_da_liga(uuid) TO authenticated;

-- mensagem do tipo 'liga' no chat (rodada e fim)
ALTER TABLE public.mensagens_da_turma DROP CONSTRAINT mensagens_da_turma_tipo_check;
ALTER TABLE public.mensagens_da_turma ADD CONSTRAINT mensagens_da_turma_tipo_check
  CHECK (tipo IN ('texto', 'lista', 'pagamento', 'liga'));

-- placar encerrado numa pelada dentro de uma liga ativa: a tabela vai pro chat
CREATE OR REPLACE FUNCTION public.liga_rodada_no_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l public.ligas;
  v_rodada int;
  v_lider record;
BEGIN
  IF NEW.placar_finalizado_em IS NULL OR OLD.placar_finalizado_em IS NOT NULL
     OR NEW.crew_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO l FROM public.ligas
  WHERE crew_id = NEW.crew_id AND encerrada_em IS NULL AND NEW.data BETWEEN inicio AND fim
  LIMIT 1;
  IF l.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_rodada FROM public.matches m
  WHERE m.crew_id = l.crew_id AND m.placar_finalizado_em IS NOT NULL
    AND m.data BETWEEN l.inicio AND l.fim;
  SELECT nome, pontos INTO v_lider FROM public.tabela_da_liga(l.id) ORDER BY posicao LIMIT 1;

  INSERT INTO public.mensagens_da_turma (crew_id, autor_id, tipo, match_id, dados)
  VALUES (l.crew_id, NULL, 'liga', NEW.id,
          jsonb_build_object('evento', 'rodada', 'liga_id', l.id, 'liga', l.nome,
                             'rodada', v_rodada, 'lider', v_lider.nome, 'pontos', v_lider.pontos));
  RETURN NULL;
END;
$$;

CREATE TRIGGER matches_liga_rodada
  AFTER UPDATE OF placar_finalizado_em ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.liga_rodada_no_chat();

-- o cron de 5 minutos também fecha as ligas que passaram do fim
CREATE OR REPLACE FUNCTION public.fechar_ligas_vencidas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN
    SELECT id FROM public.ligas
    WHERE encerrada_em IS NULL AND fim < (now() AT TIME ZONE 'America/Sao_Paulo')::date
  LOOP
    PERFORM public.fechar_liga(v_id);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.fechar_ligas_vencidas() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('fechar-ligas', '*/15 * * * *', 'SELECT public.fechar_ligas_vencidas();');
