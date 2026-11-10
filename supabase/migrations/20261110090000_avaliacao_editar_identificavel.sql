-- Editar uma nota já enviada dava "permissão negada": o UPDATE em evaluations é liberado coluna
-- por coluna (20260928120000_avaliacao_editavel.sql) e a coluna identificavel
-- (20261104090000_quem_avaliou.sql) ficou sem a liberação. O app manda ela junto ao salvar.
GRANT UPDATE (identificavel) ON public.evaluations TO authenticated;
