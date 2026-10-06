-- Nick (profiles.handle): o formato passa a ser garantido pelo banco, não só pela tela.
-- 3 a 20 caracteres: letras minúsculas, números, "_" e ".". Único (já era).
--
-- O cadastro gerava o nick a partir do e-mail sem limpar nada; com a regra nova,
-- um e-mail tipo "Joao+Fut@..." ou comprido demais travaria a criação da conta.
-- Por isso a geração também passa a limpar e cortar.

CREATE OR REPLACE FUNCTION public.gerar_nick(p_email TEXT, p_id UUID, p_pedido TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_pedido TEXT := left(regexp_replace(lower(COALESCE(p_pedido, '')), '[^a-z0-9_.]', '', 'g'), 20);
  v_base TEXT := left(regexp_replace(lower(split_part(COALESCE(p_email, ''), '@', 1)), '[^a-z0-9_.]', '', 'g'), 15);
BEGIN
  IF length(v_pedido) >= 3 THEN
    RETURN v_pedido;
  END IF;
  -- sem e-mail = convidado (login anônimo)
  IF p_email IS NULL THEN
    RETURN 'convidado_' || substr(p_id::text, 1, 8);
  END IF;
  RETURN (CASE WHEN v_base = '' THEN 'jogador' ELSE v_base END) || '_' || substr(p_id::text, 1, 4);
END;
$$;
REVOKE ALL ON FUNCTION public.gerar_nick(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_exibicao, email, handle, eh_convidado)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_exibicao', split_part(NEW.email, '@', 1), 'Convidado'),
    NEW.email,
    public.gerar_nick(NEW.email, NEW.id, NEW.raw_user_meta_data->>'handle'),
    COALESCE(NEW.is_anonymous, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_handle_formato CHECK (handle ~ '^[a-z0-9_.]{3,20}$');
