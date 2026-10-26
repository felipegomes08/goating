-- matches só deixa editar colunas liberadas uma a uma: a cores_times (20261103090000) ficou de
-- fora e o salvar das cores dava "permission denied". Libera igual à nomes_times.
GRANT INSERT (cores_times), UPDATE (cores_times) ON public.matches TO authenticated;
