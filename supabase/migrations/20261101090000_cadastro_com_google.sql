-- Cadastro com Google: o perfil novo pega o nome que vem do Google (full_name ou name) quando
-- não vem o nome digitado no formulário. A foto do Google é copiada depois, pela função
-- foto-do-google.
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
    left(COALESCE(
      NULLIF(btrim(NEW.raw_user_meta_data->>'nome_exibicao'), ''),
      NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
      NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''),
      split_part(NEW.email, '@', 1),
      'Convidado'
    ), 40),
    public.gerar_nick(NEW.email, NEW.id, NEW.raw_user_meta_data->>'handle'),
    COALESCE(NEW.is_anonymous, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
