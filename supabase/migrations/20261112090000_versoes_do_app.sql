-- Versão do app que está nas lojas, pra avisar quem abriu um app desatualizado.
--   versao_atual: a que já está publicada na loja. Abaixo dela, o app mostra "Nova versão
--                 disponível" com o botão pra loja (dá pra deixar pra depois).
--   versao_minima: abaixo dela o aviso não fecha (só pra quando a versão velha quebrar de vez).
-- Atualizar versao_atual só quando a versão nova já estiver aprovada e no ar na loja.
CREATE TABLE IF NOT EXISTS public.versoes_do_app (
  plataforma TEXT PRIMARY KEY CHECK (plataforma IN ('ios', 'android')),
  versao_atual TEXT NOT NULL,
  versao_minima TEXT NOT NULL DEFAULT '0',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.versoes_do_app ENABLE ROW LEVEL SECURITY;

-- qualquer um lê (o app confere antes até do login); ninguém escreve pelo app
DROP POLICY IF EXISTS versoes_do_app_ler ON public.versoes_do_app;
CREATE POLICY versoes_do_app_ler ON public.versoes_do_app FOR SELECT USING (true);
GRANT SELECT ON public.versoes_do_app TO anon, authenticated;

INSERT INTO public.versoes_do_app (plataforma, versao_atual) VALUES
  ('ios', '1.0.1'),
  ('android', '1.0.2')
ON CONFLICT (plataforma) DO NOTHING;
