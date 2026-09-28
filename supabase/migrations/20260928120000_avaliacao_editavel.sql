-- Avaliações editáveis + nota geral consistente com a avaliação detalhada.
--
-- 1. O avaliador pode corrigir a própria avaliação enquanto a janela de 24h
--    estiver aberta (mesma regra do INSERT, via pode_avaliar).
-- 2. A nota geral passa a ser sempre a média dos 7 atributos quando todos
--    estiverem preenchidos — o banco garante, não só a tela.
-- 3. Overall, XP do jogador e MVP da partida são recalculados também no UPDATE.

-- 1. UPDATE só nas colunas de nota (partida/avaliador/avaliado ficam imutáveis).
--    O Supabase dá UPDATE na tabela inteira para authenticated por padrão; troca
--    por grant só nas colunas de nota.
REVOKE UPDATE ON public.evaluations FROM authenticated;
GRANT UPDATE (nota_geral, chute, drible, velocidade, toque, posicionamento, comportamento, pontualidade)
  ON public.evaluations TO authenticated;

DROP POLICY IF EXISTS evaluations_update_own ON public.evaluations;
CREATE POLICY evaluations_update_own ON public.evaluations FOR UPDATE TO authenticated
  USING (auth.uid() = avaliador_id AND public.pode_avaliar(match_id, avaliador_id, avaliado_id))
  WITH CHECK (auth.uid() = avaliador_id AND public.pode_avaliar(match_id, avaliador_id, avaliado_id));

-- 2. Nota geral = média dos atributos
CREATE OR REPLACE FUNCTION public.normalizar_nota_geral()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.chute IS NOT NULL AND NEW.drible IS NOT NULL AND NEW.velocidade IS NOT NULL
     AND NEW.toque IS NOT NULL AND NEW.posicionamento IS NOT NULL
     AND NEW.comportamento IS NOT NULL AND NEW.pontualidade IS NOT NULL THEN
    NEW.nota_geral := round(
      (NEW.chute + NEW.drible + NEW.velocidade + NEW.toque
       + NEW.posicionamento + NEW.comportamento + NEW.pontualidade) / 7.0,
      2
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalizar_nota_geral() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS evaluations_normalizar_geral ON public.evaluations;
CREATE TRIGGER evaluations_normalizar_geral
BEFORE INSERT OR UPDATE ON public.evaluations
FOR EACH ROW EXECUTE FUNCTION public.normalizar_nota_geral();

-- 3. Recalcular overall, MVP e XP também quando a avaliação é corrigida
DROP TRIGGER IF EXISTS evaluations_recalc ON public.evaluations;
CREATE TRIGGER evaluations_recalc
AFTER INSERT OR UPDATE ON public.evaluations
FOR EACH ROW EXECUTE FUNCTION public.recalcular_overall();

DROP TRIGGER IF EXISTS evaluations_recalc_mvp ON public.evaluations;
CREATE TRIGGER evaluations_recalc_mvp
AFTER INSERT OR UPDATE ON public.evaluations
FOR EACH ROW EXECUTE FUNCTION public.recalcular_mvp_partida();

DROP TRIGGER IF EXISTS evaluations_recalc_xp ON public.evaluations;
CREATE TRIGGER evaluations_recalc_xp
AFTER INSERT OR UPDATE ON public.evaluations
FOR EACH ROW EXECUTE FUNCTION public.recalcular_xp_avaliacao();
