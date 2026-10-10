-- SEGURANÇA, ETAPA 1: fecha os pontos críticos antes de abrir o app pro público.
--
-- O navegador fala direto com o banco, então quem quiser trapacear não precisa do site:
-- chama a API com a própria conta. Tudo o que estava protegido só na tela passa a valer aqui.

-- ============================================================================
-- 1. PERFIL: a pessoa edita só o que é dela (nome, nick, cidade, bio, posição, foto).
--    Overall, XP, tier, MVPs, plano e "é convidado" mudam só pelos gatilhos e funções.
-- ============================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (nome_exibicao, handle, cidade, bio, posicao_preferida, foto_url, perfil_completo)
  ON public.profiles TO authenticated;
-- o perfil nasce pelo gatilho do cadastro; ninguém cria perfil pela API
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

-- ============================================================================
-- 2. E-MAIL: sai da tabela de perfis, que qualquer pessoa logada consegue ler.
--    Ele continua no cadastro (auth.users), que ninguém de fora lê. O app não usava a coluna.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_exibicao, handle, eh_convidado)
  VALUES (
    NEW.id,
    left(COALESCE(NEW.raw_user_meta_data->>'nome_exibicao', split_part(NEW.email, '@', 1), 'Convidado'), 40),
    public.gerar_nick(NEW.email, NEW.id, NEW.raw_user_meta_data->>'handle'),
    COALESCE(NEW.is_anonymous, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- ============================================================================
-- 3. PELADA: o organizador edita o formulário, a configuração do jogo e o rascunho do placar.
--    MVP, data de encerramento, placar finalizado e organizador ficam fora do alcance direto.
-- ============================================================================
REVOKE INSERT, UPDATE, TRUNCATE ON public.matches FROM authenticated, anon;
GRANT INSERT (organizador_id, crew_id, titulo, descricao, data, horario, horario_fim, local,
              local_link, cidade, quantidade_vagas, tipo, status, num_times, nomes_times,
              tempos, minutos_tempo, gols_limite, contagem_vitoria)
  ON public.matches TO authenticated;
GRANT UPDATE (crew_id, titulo, descricao, data, horario, horario_fim, local, local_link, cidade,
              quantidade_vagas, tipo, status, num_times, nomes_times, tempos, minutos_tempo,
              gols_limite, contagem_vitoria, placar_estado)
  ON public.matches TO authenticated;

-- Regras do ciclo da pelada pra quem chega pela API. As funções do sistema (salvar o placar,
-- finalizar as vencidas) rodam como dono do banco e passam direto.
CREATE OR REPLACE FUNCTION public.matches_regras()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'agendada' THEN
      RAISE EXCEPTION 'A pelada começa como agendada.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'finalizada' THEN
    IF NEW.status <> 'finalizada' THEN
      RAISE EXCEPTION 'Pelada finalizada não volta atrás.';
    END IF;
    IF NEW.data <> OLD.data OR NEW.horario <> OLD.horario THEN
      RAISE EXCEPTION 'Não dá pra mudar o dia de uma pelada que já foi finalizada.';
    END IF;
  ELSIF NEW.status = 'finalizada' THEN
    IF now() < (NEW.data + NEW.horario) AT TIME ZONE 'America/Sao_Paulo' THEN
      RAISE EXCEPTION 'Só dá pra finalizar a partir do horário da pelada.';
    END IF;
    -- a hora do encerramento é a do servidor: é ela que abre a janela de 24h das avaliações
    NEW.finalizada_em := now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.matches_regras() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS matches_regras ON public.matches;
CREATE TRIGGER matches_regras
BEFORE INSERT OR UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.matches_regras();

-- ============================================================================
-- 4. NOTAS: convidado (entrou pelo link, sem e-mail) não avalia. Criar conta de convidado
--    é de graça, então aceitar a nota deles era aceitar nota fabricada.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pode_avaliar(_match_id uuid, _avaliador uuid, _avaliado uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = _match_id
      AND m.status = 'finalizada'
      AND m.finalizada_em IS NOT NULL
      AND m.finalizada_em > now() - interval '24 hours'
      AND EXISTS (SELECT 1 FROM public.match_participants p WHERE p.match_id = m.id AND p.user_id = _avaliador AND p.status = 'aprovado')
      AND EXISTS (SELECT 1 FROM public.match_participants p WHERE p.match_id = m.id AND p.user_id = _avaliado AND p.status = 'aprovado')
      AND NOT EXISTS (SELECT 1 FROM public.profiles a WHERE a.id = _avaliador AND a.eh_convidado)
  );
$$;

-- ============================================================================
-- 5. XP: no máximo uma pelada por dia rende os 10 XP de participação.
--    Sem isso dava pra criar e finalizar peladas em série. O dia é o do encerramento,
--    que o servidor grava (item 3), não a data que o organizador digita.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calcular_xp(_uid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    COALESCE((
      SELECT count(DISTINCT COALESCE((m.finalizada_em AT TIME ZONE 'America/Sao_Paulo')::date, m.data))
      FROM public.match_participants mp
      JOIN public.matches m ON m.id = mp.match_id
      WHERE mp.user_id = _uid AND mp.status = 'aprovado' AND m.status = 'finalizada'
    ), 0) * 10
    + COALESCE((
      SELECT sum(2 + nota_geral)::int FROM public.evaluations WHERE avaliado_id = _uid
    ), 0)
    + COALESCE((SELECT vezes_mvp FROM public.profiles WHERE id = _uid), 0) * 5
  )::integer;
$$;
REVOKE ALL ON FUNCTION public.calcular_xp(uuid) FROM PUBLIC, anon, authenticated;
