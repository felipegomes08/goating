-- Chat da turma, como um grupo de WhatsApp: mensagens de texto em tempo real, contador de não
-- lidas e aviso no celular a cada mensagem (pela função enviar-push, com { mensagem_id }).
--
-- Quem participa: o dono e os jogadores da turma que têm conta e não saíram (removido_em nulo).
-- Os tipos 'lista' (confirmação da pelada) e 'pagamento' entram só por função, nas próximas
-- etapas; pela tabela, cada um só manda texto em nome próprio.

-- quem participa do chat da turma (dono ou jogador ativo com conta, turma não excluída)
CREATE OR REPLACE FUNCTION public.membro_da_turma(p_crew_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crews c
    WHERE c.id = p_crew_id AND c.excluida_em IS NULL
      AND (
        c.dono_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.crew_members cm
          WHERE cm.crew_id = c.id AND cm.user_id = auth.uid() AND cm.removido_em IS NULL
        )
      )
  );
$$;

CREATE TABLE public.mensagens_da_turma (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES public.crews (id) ON DELETE CASCADE,
  autor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'lista', 'pagamento')),
  texto text CHECK (char_length(texto) <= 2000),
  match_id uuid REFERENCES public.matches (id) ON DELETE CASCADE,
  dados jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  apagada_em timestamptz,
  push_enviado_em timestamptz,
  -- mensagem de texto tem texto (a apagada fica sem)
  CHECK (tipo <> 'texto' OR apagada_em IS NOT NULL OR length(btrim(texto)) > 0)
);
CREATE INDEX mensagens_da_turma_crew_criado ON public.mensagens_da_turma (crew_id, criado_em DESC);
CREATE INDEX mensagens_da_turma_autor_criado ON public.mensagens_da_turma (autor_id, criado_em DESC);

ALTER TABLE public.mensagens_da_turma ENABLE ROW LEVEL SECURITY;

CREATE POLICY mensagens_select_membro ON public.mensagens_da_turma
  FOR SELECT TO authenticated USING (public.membro_da_turma(crew_id));
CREATE POLICY mensagens_insert_texto ON public.mensagens_da_turma
  FOR INSERT TO authenticated
  WITH CHECK (
    tipo = 'texto' AND autor_id = auth.uid() AND match_id IS NULL AND dados IS NULL
    AND public.membro_da_turma(crew_id)
  );

REVOKE ALL ON public.mensagens_da_turma FROM anon, authenticated;
GRANT SELECT ON public.mensagens_da_turma TO authenticated;
GRANT INSERT (id, crew_id, autor_id, tipo, texto) ON public.mensagens_da_turma TO authenticated;

-- quem manda pela tabela não escolhe a hora nem pula o limite: no máximo 20 mensagens por minuto
CREATE OR REPLACE FUNCTION public.mensagens_regras()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.criado_em := now();
  NEW.apagada_em := NULL;
  NEW.push_enviado_em := NULL;
  IF NEW.texto IS NOT NULL THEN
    NEW.texto := btrim(NEW.texto);
  END IF;
  IF NEW.autor_id IS NOT NULL AND (
    SELECT count(*) FROM public.mensagens_da_turma m
    WHERE m.autor_id = NEW.autor_id AND m.criado_em > now() - interval '1 minute'
  ) >= 20 THEN
    RAISE EXCEPTION 'Calma! Muitas mensagens seguidas. Espera um pouquinho.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mensagens_regras
  BEFORE INSERT ON public.mensagens_da_turma
  FOR EACH ROW EXECUTE FUNCTION public.mensagens_regras();

-- cada mensagem nova vira aviso no celular dos outros membros (uma chamada por mensagem)
CREATE OR REPLACE FUNCTION public.mensagem_manda_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://ewyxbdjeblgbfrsjicti.supabase.co/functions/v1/enviar-push',
    body := jsonb_build_object('mensagem_id', NEW.id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER mensagens_push
  AFTER INSERT ON public.mensagens_da_turma
  FOR EACH ROW EXECUTE FUNCTION public.mensagem_manda_push();

-- até onde cada um leu e se silenciou o chat
CREATE TABLE public.chat_da_turma_leitura (
  crew_id uuid NOT NULL REFERENCES public.crews (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  lida_ate timestamptz NOT NULL DEFAULT now(),
  silenciado boolean NOT NULL DEFAULT false,
  PRIMARY KEY (crew_id, user_id)
);

ALTER TABLE public.chat_da_turma_leitura ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_leitura_select_own ON public.chat_da_turma_leitura
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.chat_da_turma_leitura FROM anon, authenticated;
GRANT SELECT ON public.chat_da_turma_leitura TO authenticated;

CREATE OR REPLACE FUNCTION public.marcar_chat_lido(p_crew_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.membro_da_turma(p_crew_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.chat_da_turma_leitura (crew_id, user_id, lida_ate)
  VALUES (p_crew_id, auth.uid(), now())
  ON CONFLICT (crew_id, user_id) DO UPDATE SET lida_ate = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.silenciar_chat(p_crew_id uuid, p_silenciar boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.membro_da_turma(p_crew_id) THEN
    RAISE EXCEPTION 'Só quem é da turma mexe no chat dela.';
  END IF;
  INSERT INTO public.chat_da_turma_leitura (crew_id, user_id, silenciado)
  VALUES (p_crew_id, auth.uid(), p_silenciar)
  ON CONFLICT (crew_id, user_id) DO UPDATE SET silenciado = p_silenciar;
END;
$$;

-- o autor ou um gestor da turma apaga; a mensagem fica como "Mensagem apagada"
CREATE OR REPLACE FUNCTION public.apagar_mensagem(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg public.mensagens_da_turma;
BEGIN
  SELECT * INTO v_msg FROM public.mensagens_da_turma WHERE id = p_id;
  IF v_msg.id IS NULL OR NOT public.membro_da_turma(v_msg.crew_id) THEN
    RAISE EXCEPTION 'Mensagem não encontrada.';
  END IF;
  IF v_msg.autor_id IS DISTINCT FROM auth.uid() AND NOT public.gere_turma(v_msg.crew_id) THEN
    RAISE EXCEPTION 'Só quem mandou ou um administrador apaga a mensagem.';
  END IF;
  UPDATE public.mensagens_da_turma
  SET apagada_em = now(), texto = NULL, dados = NULL
  WHERE id = p_id AND apagada_em IS NULL;
END;
$$;

-- mensagens de outras pessoas depois da última leitura, por turma (sem leitura: desde que entrou)
CREATE OR REPLACE FUNCTION public.chats_nao_lidos()
RETURNS TABLE(crew_id uuid, nao_lidas integer, silenciado boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH minhas AS (
    SELECT c.id,
      COALESCE(
        l.lida_ate,
        (SELECT min(cm.criado_em) FROM public.crew_members cm
         WHERE cm.crew_id = c.id AND cm.user_id = auth.uid()),
        c.criado_em
      ) AS desde,
      COALESCE(l.silenciado, false) AS silenciado
    FROM public.crews c
    LEFT JOIN public.chat_da_turma_leitura l ON l.crew_id = c.id AND l.user_id = auth.uid()
    WHERE public.membro_da_turma(c.id)
  )
  SELECT t.id,
    (SELECT count(*) FROM public.mensagens_da_turma m
     WHERE m.crew_id = t.id AND m.criado_em > t.desde AND m.apagada_em IS NULL
       AND m.autor_id IS DISTINCT FROM auth.uid())::integer,
    t.silenciado
  FROM minhas t;
$$;

REVOKE ALL ON FUNCTION public.membro_da_turma(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marcar_chat_lido(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.silenciar_chat(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apagar_mensagem(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chats_nao_lidos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.membro_da_turma(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_chat_lido(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.silenciar_chat(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apagar_mensagem(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chats_nao_lidos() TO authenticated;

-- tempo real: mensagem nova e apagada chegam na hora (a RLS filtra quem recebe)
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensagens_da_turma;
