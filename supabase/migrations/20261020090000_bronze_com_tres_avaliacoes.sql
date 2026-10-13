-- Bronze já na terceira avaliação. Antes precisava também de 200 XP, e quem tinha acabado
-- de liberar o overall ficava "sem tier" por várias peladas. Os outros tiers não mudam.
CREATE OR REPLACE FUNCTION public.tier_do_jogador(_overall numeric, _xp integer, _avaliacoes integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _avaliacoes < 3 THEN NULL
    WHEN _overall >= 95 AND _xp >= 7000 THEN 'GOAT'
    WHEN _overall >= 90 AND _xp >= 4000 THEN 'Lendário'
    WHEN _overall >= 80 AND _xp >= 2000 THEN 'Platina'
    WHEN _overall >= 70 AND _xp >= 950 THEN 'Ouro'
    WHEN _overall >= 60 AND _xp >= 300 THEN 'Prata'
    ELSE 'Bronze'
  END;
$$;

-- quem já tem as 3 avaliações e ainda estava sem tier: o Bronze fica esperando pra ser
-- revelado, como qualquer subida (a pessoa abre o app e toca no presente da carta)
UPDATE public.profiles
SET tier_pendente = 'Bronze'
WHERE avaliacoes_recebidas >= 3 AND tier_reconhecido IS NULL AND tier_pendente IS NULL;

-- acerto pedido pelo verificador do Supabase: a função da janela de avaliação fica presa
-- ao esquema dela
ALTER FUNCTION public.janela_de_avaliacao() SET search_path = public;
