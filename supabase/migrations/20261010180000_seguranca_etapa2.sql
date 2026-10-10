-- SEGURANÇA, ETAPA 2: limites de volume, avaliações privadas, convites, funções e exclusões.

-- ============================================================================
-- 1. TAMANHO DOS TEXTOS. Sem teto, um script enchia o banco com um campo só.
-- ============================================================================
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tamanhos CHECK (
    char_length(nome_exibicao) BETWEEN 1 AND 40
    AND (bio IS NULL OR char_length(bio) <= 160)
    AND (cidade IS NULL OR char_length(cidade) <= 80)
    AND (posicao_preferida IS NULL OR char_length(posicao_preferida) <= 10)
    AND (foto_url IS NULL OR char_length(foto_url) <= 300)
  );
ALTER TABLE public.matches
  ADD CONSTRAINT matches_tamanhos CHECK (
    char_length(titulo) BETWEEN 1 AND 60
    AND (descricao IS NULL OR char_length(descricao) <= 500)
    AND char_length(local) <= 80
    AND char_length(cidade) <= 80
    AND (nomes_times IS NULL OR (cardinality(nomes_times) <= 6 AND char_length(array_to_string(nomes_times, '')) <= 180))
    AND (placar_estado IS NULL OR pg_column_size(placar_estado) <= 200000)
  );
ALTER TABLE public.crews
  ADD CONSTRAINT crews_tamanhos CHECK (
    char_length(nome) BETWEEN 1 AND 40
    AND (escudo_url IS NULL OR char_length(escudo_url) <= 300)
    AND (capa_url IS NULL OR char_length(capa_url) <= 300)
  );
ALTER TABLE public.crew_members
  ADD CONSTRAINT crew_members_tamanhos CHECK (
    char_length(nome) BETWEEN 1 AND 40
    AND (posicao IS NULL OR char_length(posicao) <= 10)
  );

-- ============================================================================
-- 2. COTAS POR USUÁRIO (o "rate limit" de uso). Valem pra quem chega pela API;
--    as funções do sistema rodam como dono do banco e passam direto.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cota_de_criacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- sem usuário logado quem está gravando é o próprio sistema (rotinas, manutenção)
  IF auth.uid() IS NULL OR auth.role() NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'matches' THEN
    -- uma recorrente cria até 12 de uma vez; 40 por dia cobre isso com folga
    IF (SELECT count(*) FROM public.matches m
        WHERE m.organizador_id = NEW.organizador_id AND m.criado_em > now() - interval '24 hours') >= 40 THEN
      RAISE EXCEPTION 'Você criou peladas demais hoje. Tenta de novo amanhã.';
    END IF;
  ELSIF TG_TABLE_NAME = 'crews' THEN
    IF (SELECT count(*) FROM public.crews c
        WHERE c.dono_id = NEW.dono_id AND c.criado_em > now() - interval '24 hours') >= 10 THEN
      RAISE EXCEPTION 'Você criou turmas demais hoje. Tenta de novo amanhã.';
    END IF;
    IF (SELECT count(*) FROM public.crews c
        WHERE c.dono_id = NEW.dono_id AND c.excluida_em IS NULL) >= 30 THEN
      RAISE EXCEPTION 'Você chegou no limite de 30 turmas. Exclua alguma pra criar outra.';
    END IF;
  ELSIF TG_TABLE_NAME = 'crew_members' THEN
    IF (SELECT count(*) FROM public.crew_members cm
        WHERE cm.crew_id = NEW.crew_id AND cm.removido_em IS NULL) >= 200 THEN
      RAISE EXCEPTION 'A turma chegou no limite de 200 jogadores.';
    END IF;
  ELSIF TG_TABLE_NAME = 'followers' THEN
    IF (SELECT count(*) FROM public.followers f WHERE f.seguidor_id = NEW.seguidor_id) >= 2000 THEN
      RAISE EXCEPTION 'Você chegou no limite de 2.000 jogadores seguidos.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.cota_de_criacao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS matches_cota ON public.matches;
CREATE TRIGGER matches_cota BEFORE INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.cota_de_criacao();
DROP TRIGGER IF EXISTS crews_cota ON public.crews;
CREATE TRIGGER crews_cota BEFORE INSERT ON public.crews
  FOR EACH ROW EXECUTE FUNCTION public.cota_de_criacao();
DROP TRIGGER IF EXISTS crew_members_cota ON public.crew_members;
CREATE TRIGGER crew_members_cota BEFORE INSERT ON public.crew_members
  FOR EACH ROW EXECUTE FUNCTION public.cota_de_criacao();
DROP TRIGGER IF EXISTS followers_cota ON public.followers;
CREATE TRIGGER followers_cota BEFORE INSERT ON public.followers
  FOR EACH ROW EXECUTE FUNCTION public.cota_de_criacao();

-- ============================================================================
-- 3. AVALIAÇÕES PRIVADAS: cada um lê só as notas que deu. As médias de um jogador
--    saem de uma função, sem mostrar quem deu qual nota.
-- ============================================================================
DROP POLICY IF EXISTS "evaluations_select_auth" ON public.evaluations;
CREATE POLICY "evaluations_select_proprias" ON public.evaluations FOR SELECT TO authenticated
  USING (auth.uid() = avaliador_id);

CREATE OR REPLACE FUNCTION public.medias_do_jogador(p_user_id UUID)
RETURNS TABLE (
  total BIGINT, nota_geral NUMERIC, chute NUMERIC, drible NUMERIC, velocidade NUMERIC,
  toque NUMERIC, posicionamento NUMERIC, comportamento NUMERIC, pontualidade NUMERIC
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*), avg(e.nota_geral), avg(e.chute), avg(e.drible), avg(e.velocidade),
         avg(e.toque), avg(e.posicionamento), avg(e.comportamento), avg(e.pontualidade)
  FROM public.evaluations e
  WHERE e.avaliado_id = p_user_id;
$$;

-- ============================================================================
-- 4. CONVITES: o link da pelada aparece só pra quem organiza ou já está confirmado nela.
--    Quem recebe o link continua vendo a prévia pela função convite_info.
-- ============================================================================
DROP POLICY IF EXISTS "invite_links_select_all" ON public.match_invite_links;
CREATE POLICY "invite_links_select_da_pelada" ON public.match_invite_links FOR SELECT TO authenticated
  USING (
    public.gere_pelada(match_id)
    OR EXISTS (
      SELECT 1 FROM public.match_participants p
      WHERE p.match_id = match_invite_links.match_id AND p.user_id = auth.uid() AND p.status = 'aprovado'
    )
  );

-- ============================================================================
-- 5. EXCLUSÕES que não podem levar embora o que é dos outros.
-- ============================================================================
-- pelada finalizada com mais alguém com conta: o organizador não apaga (levaria XP e notas deles)
DROP POLICY IF EXISTS "matches_delete_owner" ON public.matches;
CREATE POLICY "matches_delete_owner" ON public.matches FOR DELETE TO authenticated
  USING (
    auth.uid() = organizador_id
    AND (
      status <> 'finalizada'
      OR NOT EXISTS (
        SELECT 1 FROM public.match_participants p
        WHERE p.match_id = matches.id AND p.user_id <> auth.uid() AND p.status = 'aprovado'
      )
    )
  );
-- turma só sai pela função excluir_turma, que preserva as peladas já jogadas
DROP POLICY IF EXISTS "crews_delete_own" ON public.crews;
REVOKE DELETE ON public.crews FROM authenticated;

-- o organizador só muda a situação do participante (aprovar, recusar), não troca a pessoa
REVOKE UPDATE ON public.match_participants FROM authenticated;
GRANT UPDATE (status) ON public.match_participants TO authenticated;

-- ============================================================================
-- 6. PORTAS FECHADAS: quem não está logado não mexe em tabela nenhuma, e as funções
--    internas (gatilhos, rotina de finalizar) não são chamáveis pela API.
-- ============================================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON public.card_tiers TO anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.convite_info(text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.crew_stats(uuid, date, date),
  public.minhas_turmas(),
  public.medias_do_jogador(uuid),
  public.definir_admin(uuid, boolean),
  public.entrar_na_turma(uuid, uuid),
  public.sair_da_turma(uuid),
  public.remover_da_turma(uuid),
  public.vincular_membro(uuid, uuid),
  public.excluir_turma(uuid),
  public.excluir_minha_conta(),
  public.salvar_placar(uuid, jsonb),
  public.reivindicar_tier(),
  -- usadas dentro das regras de acesso e de gatilhos que rodam como o próprio usuário
  public.gere_turma(uuid),
  public.gere_pelada(uuid),
  public.gere_pasta_da_turma(text),
  public.pode_avaliar(uuid, uuid, uuid),
  public.tier_do_jogador(numeric, integer, integer),
  public.tier_ordem(text)
  TO authenticated;

ALTER FUNCTION public.tier_do_jogador(numeric, integer, integer) SET search_path = public;
ALTER FUNCTION public.tier_ordem(text) SET search_path = public;
ALTER FUNCTION public.verificar_subida_tier() SET search_path = public;
