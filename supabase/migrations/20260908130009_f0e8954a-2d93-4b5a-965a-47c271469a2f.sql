REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalcular_overall() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalcular_peladas_jogadas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pode_avaliar(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_avaliar(UUID, UUID, UUID) TO authenticated;