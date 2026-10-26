-- Celular da pessoa, pra contato futuro do Goating. Opcional.
--
-- Fica numa tabela à parte, e não em profiles, porque os perfis são lidos por qualquer pessoa
-- logada: o celular só é visto e mexido pelo próprio dono. Guarda só os dígitos, com DDD e
-- sem o 55 (ex.: 11987654321); a máscara é feita na tela.
CREATE TABLE public.contatos (
  id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  celular text CHECK (celular ~ '^[1-9][1-9]9[0-9]{8}$'),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY contatos_select_own ON public.contatos
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY contatos_insert_own ON public.contatos
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY contatos_update_own ON public.contatos
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.contatos TO authenticated;

REVOKE ALL ON public.contatos FROM anon;
