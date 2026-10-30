-- Pelada que não aconteceu não conta.
--
-- Antes, toda pelada "agendada" era finalizada sozinha no horário de fim, mesmo sem ninguém
-- ter iniciado o placar (29/10: a Pelada de Quinta não rolou e ficou como jogada). Agora:
--   - chegou a hora e ninguém iniciou: ela fica PENDENTE (continua "agendada", aparece nas
--     ativas e dá pra iniciar o placar ou finalizar a qualquer momento); o organizador recebe
--     um aviso perguntando se rolou;
--   - passou do horário de fim + a janela de avaliação da turma (padrão 2h) e ninguém iniciou:
--     ela é CANCELADA sozinha (fica no histórico como cancelada, sem contar pra ninguém);
--   - o organizador pode cancelar a qualquer momento (em vez de apagar).
-- Pelada com placar iniciado ("em_andamento") segue como antes: o organizador encerra.

-- fim da pelada (horário de fim, ou 1h depois do início) no fuso de Brasília
CREATE OR REPLACE FUNCTION public.fim_da_pelada(m public.matches)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (m.data + COALESCE(m.horario_fim, m.horario + interval '1 hour')) AT TIME ZONE 'America/Sao_Paulo';
$$;

-- até quando a pelada pendente espera alguém iniciar: fim + janela de avaliação da turma
CREATE OR REPLACE FUNCTION public.prazo_da_pendente(m public.matches)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.fim_da_pelada(m) + COALESCE(
    (SELECT make_interval(hours => c.janela_avaliacao_horas) FROM public.crews c WHERE c.id = m.crew_id),
    public.janela_de_avaliacao()
  );
$$;

-- roda a cada 5 minutos (cron "finalizar-peladas-vencidas"): avisa as pendentes e cancela as
-- que ninguém iniciou até o prazo. Não finaliza mais nada sozinha.
CREATE OR REPLACE FUNCTION public.finalizar_peladas_vencidas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.matches%ROWTYPE;
BEGIN
  -- chegou a hora e ninguém iniciou: pergunta pro organizador (uma vez por pelada)
  FOR m IN
    SELECT * FROM public.matches
    WHERE status = 'agendada'
      AND (data + horario) AT TIME ZONE 'America/Sao_Paulo' <= now()
      AND public.prazo_da_pendente(matches) > now()
  LOOP
    PERFORM public.notificar(m.organizador_id, 'pendente',
      'A ' || m.titulo || ' rolou?',
      'Inicie o placar ou finalize se já jogaram. Se não rolou, cancele. Sem isso ela é cancelada às '
        || to_char(public.prazo_da_pendente(m) AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || '.',
      '/pelada/' || m.id, 'pendente:' || m.id, true);
  END LOOP;

  -- passou do prazo sem ninguém iniciar: cancela (não conta como jogada)
  UPDATE public.matches
  SET status = 'cancelada'
  WHERE status = 'agendada'
    AND public.prazo_da_pendente(matches) <= now();
END;
$$;

-- regras de status: cancelada não volta; só cancela o que ainda não terminou
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

  IF OLD.status = 'cancelada' THEN
    RAISE EXCEPTION 'Essa pelada foi cancelada.';
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
    -- a hora do encerramento é a do servidor: é ela que abre a janela das avaliações
    NEW.finalizada_em := now();
  END IF;
  RETURN NEW;
END;
$$;

-- conserta a de 29/10 (antes do gatilho de aviso, pra não mandar aviso de algo de ontem): não rolou e foi finalizada sozinha (sem placar e sem avaliações).
-- O gatilho matches_recalcula_quem_jogou recalcula peladas jogadas e XP de quem estava nela.
UPDATE public.matches
SET status = 'cancelada', finalizada_em = NULL, avaliacao_ate = NULL
WHERE id = '828ff96f-c597-4ba1-b758-efae94e1ed0e'
  AND status = 'finalizada' AND placar_estado IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.evaluations e WHERE e.match_id = matches.id);

-- avisos: cancelada (pelo organizador ou sozinha) avisa quem tinha confirmado
CREATE OR REPLACE FUNCTION public.notif_pelada_cancelada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u uuid;
BEGIN
  IF NEW.status = 'cancelada' AND OLD.status IS DISTINCT FROM 'cancelada' THEN
    FOR u IN
      SELECT user_id FROM public.match_participants WHERE match_id = NEW.id AND status = 'aprovado'
      UNION SELECT NEW.organizador_id
    LOOP
      PERFORM public.notificar(u, 'cancelada',
        'A ' || NEW.titulo || ' de ' || to_char(NEW.data, 'DD/MM') || ' foi cancelada',
        CASE WHEN auth.uid() IS NULL
             THEN 'Ninguém iniciou a pelada no horário. Ela fica no histórico e não conta.'
             ELSE 'Ela fica no histórico e não conta.' END,
        '/pelada/' || NEW.id, 'cancelada:' || NEW.id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER notif_pelada_cancelada
  AFTER UPDATE OF status ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.notif_pelada_cancelada();
