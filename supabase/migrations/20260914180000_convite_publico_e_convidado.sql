-- 1) Preview público do convite (sem logar): função em vez de abrir RLS de
-- "matches"/"profiles" pra anon inteiro. Só devolve o que a tela de convite
-- precisa mostrar, e só quando o token existe e está ativo.
CREATE OR REPLACE FUNCTION public.convite_info(p_token TEXT)
RETURNS TABLE (
  match_id UUID,
  titulo TEXT,
  data DATE,
  horario TIME,
  local TEXT,
  cidade TEXT,
  quantidade_vagas INTEGER,
  tipo TEXT,
  confirmados BIGINT,
  organizador_nome TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    m.id,
    m.titulo,
    m.data,
    m.horario,
    m.local,
    m.cidade,
    m.quantidade_vagas,
    m.tipo,
    (
      SELECT count(*) FROM public.match_participants mp
      WHERE mp.match_id = m.id AND mp.status = 'aprovado'
    ),
    p.nome_exibicao
  FROM public.match_invite_links mil
  JOIN public.matches m ON m.id = mil.match_id
  LEFT JOIN public.profiles p ON p.id = m.organizador_id
  WHERE mil.token = p_token AND mil.ativo = true AND m.status = 'agendada';
$$;
REVOKE ALL ON FUNCTION public.convite_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convite_info(TEXT) TO anon, authenticated;

-- 2) Suporte a "entrar como convidado" via login anônimo do Supabase Auth.
-- Usuário anônimo não tem email (NEW.email é NULL) — o trigger original
-- quebrava nesse caso (nome_exibicao/handle ficariam NULL, violando NOT NULL).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS eh_convidado BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_exibicao, email, handle, eh_convidado)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_exibicao', split_part(NEW.email, '@', 1), 'Convidado'),
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'handle',
      split_part(NEW.email, '@', 1) || '_' || substr(NEW.id::text, 1, 4),
      'convidado_' || substr(NEW.id::text, 1, 8)
    ),
    COALESCE(NEW.is_anonymous, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
