-- Push: as notificações do sino chegam também no celular, com o app fechado.
--
-- O app registra o celular (token do Firebase) depois do login. Toda notificação nova
-- chama a função `enviar-push`, que manda pro Firebase entregar em cada celular da pessoa,
-- respeitando os tipos de aviso que ela desligou no perfil.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 1. CELULARES DE CADA PESSOA
CREATE TABLE IF NOT EXISTS public.dispositivos (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plataforma TEXT NOT NULL DEFAULT 'android',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dispositivos_user_idx ON public.dispositivos (user_id);
ALTER TABLE public.dispositivos ENABLE ROW LEVEL SECURITY;
-- ninguém lê nem grava direto: só pelas duas funções abaixo
REVOKE ALL ON public.dispositivos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.dispositivos TO service_role;

-- o celular passa a ser da conta que acabou de entrar (troca de conta no mesmo aparelho)
CREATE OR REPLACE FUNCTION public.registrar_dispositivo(p_token TEXT, p_plataforma TEXT DEFAULT 'android')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_token IS NULL OR length(p_token) > 4096 THEN
    RETURN;
  END IF;
  INSERT INTO public.dispositivos (token, user_id, plataforma)
  VALUES (p_token, auth.uid(), left(COALESCE(p_plataforma, 'android'), 20))
  ON CONFLICT (token) DO UPDATE
    SET user_id = auth.uid(), plataforma = EXCLUDED.plataforma, atualizado_em = now();
END;
$$;

-- ao sair da conta, o celular para de receber os avisos dela
CREATE OR REPLACE FUNCTION public.esquecer_dispositivo(p_token TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.dispositivos WHERE token = p_token AND user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.registrar_dispositivo(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.esquecer_dispositivo(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_dispositivo(TEXT, TEXT), public.esquecer_dispositivo(TEXT)
  TO authenticated;

-- 2. TIPOS DE AVISO DESLIGADOS (peladas, organizador, turma, avaliacao, conquistas, social)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_desligados TEXT[] NOT NULL DEFAULT '{}';
GRANT UPDATE (push_desligados) ON public.profiles TO authenticated;

-- 3. CADA NOTIFICAÇÃO NOVA VAI PRO CELULAR
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS push_enviado_em TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.mandar_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- só chama a função se a pessoa tem celular registrado
  IF EXISTS (SELECT 1 FROM public.dispositivos d WHERE d.user_id = NEW.user_id) THEN
    PERFORM net.http_post(
      url := 'https://ewyxbdjeblgbfrsjicti.supabase.co/functions/v1/enviar-push',
      body := jsonb_build_object('id', NEW.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.mandar_push() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS mandar_push ON public.notificacoes;
CREATE TRIGGER mandar_push
AFTER INSERT ON public.notificacoes
FOR EACH ROW EXECUTE FUNCTION public.mandar_push();
