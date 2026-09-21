ALTER TABLE public.followers ADD CONSTRAINT followers_nao_pode_seguir_a_si_mesmo CHECK (seguidor_id <> seguido_id);
