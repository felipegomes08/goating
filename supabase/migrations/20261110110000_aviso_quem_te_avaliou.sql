-- Quando a janela de avaliação fecha (fechar_mvps marca mvp_fechado_em), cada jogador que
-- recebeu nota ganha um aviso "N pessoas te avaliaram". O link abre a pelada já com a folha de
-- avaliações aberta: quem é Premium vê quem deu cada nota; quem não é vê o convite pro Premium.
CREATE OR REPLACE FUNCTION public.notif_quem_te_avaliou()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF NEW.mvp_fechado_em IS NULL OR OLD.mvp_fechado_em IS NOT NULL THEN
    RETURN NULL;
  END IF;
  FOR r IN
    SELECT e.avaliado_id AS usuario, count(*) AS total
    FROM public.evaluations e
    WHERE e.match_id = NEW.id
    GROUP BY e.avaliado_id
  LOOP
    PERFORM public.notificar(
      r.usuario,
      'quem_avaliou',
      r.total || CASE WHEN r.total = 1 THEN ' pessoa te avaliou' ELSE ' pessoas te avaliaram' END
        || ' na ' || NEW.titulo,
      CASE WHEN public.eh_premium(r.usuario)
        THEN 'Toque pra ver quem deu cada nota.'
        ELSE 'Quer saber quem foi? Toque pra ver 👀'
      END,
      '/pelada/' || NEW.id || '?avaliacoes=1',
      'quem_avaliou:' || NEW.id,
      true
    );
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS notif_quem_te_avaliou ON public.matches;
CREATE TRIGGER notif_quem_te_avaliou
AFTER UPDATE OF mvp_fechado_em ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.notif_quem_te_avaliou();
