-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_exibicao TEXT NOT NULL,
  handle TEXT UNIQUE,
  email TEXT,
  foto_url TEXT,
  bio TEXT,
  cidade TEXT,
  posicao_preferida TEXT,
  overall NUMERIC(5,2) NOT NULL DEFAULT 0,
  peladas_jogadas INTEGER NOT NULL DEFAULT 0,
  avaliacoes_recebidas INTEGER NOT NULL DEFAULT 0,
  vezes_mvp INTEGER NOT NULL DEFAULT 0,
  plano TEXT NOT NULL DEFAULT 'free' CHECK (plano IN ('free','premium')),
  perfil_completo BOOLEAN NOT NULL DEFAULT false,
  card_gerado_url TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_exibicao, email, handle)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_exibicao', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'handle', split_part(NEW.email, '@', 1) || '_' || substr(NEW.id::text, 1, 4))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CARD TIERS
CREATE TABLE public.card_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  overall_minimo INTEGER NOT NULL,
  peladas_minimas INTEGER NOT NULL,
  ordem INTEGER NOT NULL UNIQUE
);
GRANT SELECT ON public.card_tiers TO authenticated, anon;
GRANT ALL ON public.card_tiers TO service_role;
ALTER TABLE public.card_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card_tiers_select_all" ON public.card_tiers FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.card_tiers (nome, overall_minimo, peladas_minimas, ordem) VALUES
  ('Bronze', 0, 5, 1),
  ('Prata', 60, 8, 2),
  ('Ouro', 70, 25, 3),
  ('Platina', 80, 50, 4),
  ('Lendário', 90, 100, 5),
  ('GOAT', 95, 180, 6);

-- MATCHES
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data DATE NOT NULL,
  horario TIME NOT NULL,
  local TEXT NOT NULL,
  cidade TEXT NOT NULL,
  quantidade_vagas INTEGER NOT NULL CHECK (quantidade_vagas BETWEEN 2 AND 30),
  tipo TEXT NOT NULL DEFAULT 'aberta' CHECK (tipo IN ('aberta','fechada')),
  status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','em_andamento','finalizada','cancelada')),
  finalizada_em TIMESTAMPTZ,
  mvp_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX matches_cidade_idx ON public.matches (lower(cidade));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_select_auth" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "matches_insert_own" ON public.matches FOR INSERT TO authenticated WITH CHECK (auth.uid() = organizador_id);
CREATE POLICY "matches_update_owner" ON public.matches FOR UPDATE TO authenticated USING (auth.uid() = organizador_id) WITH CHECK (auth.uid() = organizador_id);
CREATE POLICY "matches_delete_owner" ON public.matches FOR DELETE TO authenticated USING (auth.uid() = organizador_id);

-- INVITE LINKS
CREATE TABLE public.match_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX match_invite_links_one_active ON public.match_invite_links (match_id) WHERE ativo;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_invite_links TO authenticated;
GRANT SELECT ON public.match_invite_links TO anon;
GRANT ALL ON public.match_invite_links TO service_role;
ALTER TABLE public.match_invite_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invite_links_select_all" ON public.match_invite_links FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "invite_links_manage_owner" ON public.match_invite_links FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.organizador_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.organizador_id = auth.uid()));

-- PARTICIPANTS
CREATE TABLE public.match_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
  entrou_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_participants TO authenticated;
GRANT ALL ON public.match_participants TO service_role;
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants_select_auth" ON public.match_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "participants_insert_self" ON public.match_participants FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND m.status = 'agendada'
        AND (
          (m.tipo = 'aberta' AND status = 'aprovado')
          OR (m.tipo = 'fechada' AND status = 'pendente')
        )
        AND (
          SELECT count(*) FROM public.match_participants p
          WHERE p.match_id = m.id AND p.status = 'aprovado'
        ) < m.quantidade_vagas
    )
  );
CREATE POLICY "participants_update_owner" ON public.match_participants FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.organizador_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.organizador_id = auth.uid()));
CREATE POLICY "participants_delete_self_or_owner" ON public.match_participants FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.organizador_id = auth.uid()));

-- EVALUATIONS
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  avaliador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  avaliado_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nota_geral NUMERIC(4,2) NOT NULL CHECK (nota_geral BETWEEN 0 AND 10),
  chute NUMERIC(4,2) CHECK (chute BETWEEN 0 AND 10),
  drible NUMERIC(4,2) CHECK (drible BETWEEN 0 AND 10),
  velocidade NUMERIC(4,2) CHECK (velocidade BETWEEN 0 AND 10),
  toque NUMERIC(4,2) CHECK (toque BETWEEN 0 AND 10),
  posicionamento NUMERIC(4,2) CHECK (posicionamento BETWEEN 0 AND 10),
  comportamento NUMERIC(4,2) CHECK (comportamento BETWEEN 0 AND 10),
  pontualidade NUMERIC(4,2) CHECK (pontualidade BETWEEN 0 AND 10),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT evaluations_no_self CHECK (avaliador_id <> avaliado_id),
  UNIQUE (match_id, avaliador_id, avaliado_id)
);
GRANT SELECT, INSERT ON public.evaluations TO authenticated;
GRANT ALL ON public.evaluations TO service_role;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pode_avaliar(_match_id UUID, _avaliador UUID, _avaliado UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = _match_id
      AND m.status = 'finalizada'
      AND m.finalizada_em IS NOT NULL
      AND m.finalizada_em > now() - interval '24 hours'
      AND EXISTS (SELECT 1 FROM public.match_participants p WHERE p.match_id = m.id AND p.user_id = _avaliador AND p.status = 'aprovado')
      AND EXISTS (SELECT 1 FROM public.match_participants p WHERE p.match_id = m.id AND p.user_id = _avaliado AND p.status = 'aprovado')
  );
$$;

CREATE POLICY "evaluations_select_auth" ON public.evaluations FOR SELECT TO authenticated USING (true);
CREATE POLICY "evaluations_insert_valid" ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = avaliador_id AND public.pode_avaliar(match_id, avaliador_id, avaliado_id));

-- Recalcula overall e contador de avaliacoes em tempo real
CREATE OR REPLACE FUNCTION public.recalcular_overall()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles p
  SET overall = sub.media, avaliacoes_recebidas = sub.total
  FROM (
    SELECT round(avg(nota_geral) * 10, 2) AS media, count(*) AS total
    FROM public.evaluations WHERE avaliado_id = NEW.avaliado_id
  ) sub
  WHERE p.id = NEW.avaliado_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER evaluations_recalc AFTER INSERT ON public.evaluations
FOR EACH ROW EXECUTE FUNCTION public.recalcular_overall();

-- Contador de peladas jogadas
CREATE OR REPLACE FUNCTION public.recalcular_peladas_jogadas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid UUID := COALESCE(NEW.user_id, OLD.user_id);
BEGIN
  UPDATE public.profiles p
  SET peladas_jogadas = (
    SELECT count(*) FROM public.match_participants mp
    JOIN public.matches m ON m.id = mp.match_id
    WHERE mp.user_id = _uid AND mp.status = 'aprovado' AND m.status = 'finalizada'
  )
  WHERE p.id = _uid;
  RETURN NULL;
END;
$$;
CREATE TRIGGER participants_recalc AFTER INSERT OR UPDATE OR DELETE ON public.match_participants
FOR EACH ROW EXECUTE FUNCTION public.recalcular_peladas_jogadas();

-- FOLLOWERS
CREATE TABLE public.followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seguidor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seguido_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (seguidor_id, seguido_id),
  CONSTRAINT followers_no_self CHECK (seguidor_id <> seguido_id)
);
GRANT SELECT, INSERT, DELETE ON public.followers TO authenticated;
GRANT ALL ON public.followers TO service_role;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followers_select_auth" ON public.followers FOR SELECT TO authenticated USING (true);
CREATE POLICY "followers_insert_self" ON public.followers FOR INSERT TO authenticated WITH CHECK (auth.uid() = seguidor_id);
CREATE POLICY "followers_delete_self" ON public.followers FOR DELETE TO authenticated USING (auth.uid() = seguidor_id);