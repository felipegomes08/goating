ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS horario_fim time without time zone;

-- convite_info precisa devolver horario_fim e descricao pro preview do link de convite
DROP FUNCTION IF EXISTS public.convite_info(TEXT);
CREATE FUNCTION public.convite_info(p_token TEXT)
RETURNS TABLE (
  match_id UUID, titulo TEXT, descricao TEXT, data DATE, horario TIME, horario_fim TIME, local TEXT, cidade TEXT,
  quantidade_vagas INTEGER, tipo TEXT, confirmados BIGINT, organizador_nome TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.titulo, m.descricao, m.data, m.horario, m.horario_fim, m.local, m.cidade, m.quantidade_vagas, m.tipo,
    (SELECT count(*) FROM public.match_participants mp WHERE mp.match_id = m.id AND mp.status = 'aprovado'),
    p.nome_exibicao
  FROM public.match_invite_links mil
  JOIN public.matches m ON m.id = mil.match_id
  LEFT JOIN public.profiles p ON p.id = m.organizador_id
  WHERE mil.token = p_token AND mil.ativo = true AND m.status = 'agendada';
$$;
REVOKE ALL ON FUNCTION public.convite_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convite_info(TEXT) TO anon, authenticated;
