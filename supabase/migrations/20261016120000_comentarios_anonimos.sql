-- Comentários anônimos, de jogador e de turma. Assinado, ninguém tinha coragem de falar
-- com honestidade. As funções abaixo são a única porta de leitura dos comentários, então
-- o nome de quem escreveu deixa de sair do banco (não é só escondido na tela).
--
-- O formato da resposta continua o mesmo, pra não quebrar o site que já está no ar:
-- os campos de autor e o nome da pelada vêm vazios, e a data vem arredondada pro mês
-- (dia e pelada ajudariam a adivinhar quem escreveu). Dentro do mês a ordem é embaralhada,
-- sempre do mesmo jeito, pra sequência também não entregar ninguém.
--
-- Continua igual: quem escreveu reconhece o próprio comentário ("meu") e pode apagar,
-- qualquer um pode denunciar, e 3 denúncias escondem. O Goating segue guardando quem
-- escreveu, pra poder tratar denúncia.

CREATE OR REPLACE FUNCTION public.comentarios_do_jogador(p_user_id UUID)
RETURNS TABLE (
  id UUID, autor_id UUID, autor_nome TEXT, autor_foto TEXT, comentario TEXT,
  criado_em TIMESTAMPTZ, pelada TEXT, meu BOOLEAN, denunciei BOOLEAN, oculto BOOLEAN
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id, NULL::uuid, 'Anônimo'::text, NULL::text, e.comentario,
    date_trunc('month', e.criado_em), NULL::text,
    e.avaliador_id = auth.uid(),
    EXISTS (SELECT 1 FROM public.denuncias d
            WHERE d.tipo = 'comentario_jogador' AND d.alvo_id = e.id AND d.denunciante_id = auth.uid()),
    public.comentario_oculto('comentario_jogador', e.id)
  FROM public.evaluations e
  WHERE e.avaliado_id = p_user_id
    AND e.comentario IS NOT NULL
    AND (e.avaliador_id = auth.uid() OR NOT public.comentario_oculto('comentario_jogador', e.id))
  ORDER BY date_trunc('month', e.criado_em) DESC, md5(e.id::text)
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.comentarios_da_turma(p_crew_id UUID)
RETURNS TABLE (
  id UUID, autor_id UUID, autor_nome TEXT, autor_foto TEXT, comentario TEXT,
  criado_em TIMESTAMPTZ, meu BOOLEAN, denunciei BOOLEAN, oculto BOOLEAN
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id, NULL::uuid, 'Anônimo'::text, NULL::text, r.comentario,
    date_trunc('month', r.atualizado_em),
    r.autor_id = auth.uid(),
    EXISTS (SELECT 1 FROM public.denuncias d
            WHERE d.tipo = 'comentario_turma' AND d.alvo_id = r.id AND d.denunciante_id = auth.uid()),
    public.comentario_oculto('comentario_turma', r.id)
  FROM public.crew_reviews r
  WHERE r.crew_id = p_crew_id
    AND r.comentario IS NOT NULL
    AND (r.autor_id = auth.uid() OR NOT public.comentario_oculto('comentario_turma', r.id))
  ORDER BY date_trunc('month', r.atualizado_em) DESC, md5(r.id::text)
  LIMIT 50;
$$;
