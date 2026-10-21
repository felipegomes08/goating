-- Premium, base: quem é Premium e o que a pessoa escolhe pra aparência (moldura da carta e capa
-- do perfil). A cobrança ainda não existe: por enquanto o Premium é ligado à mão pelo banco.

-- 1. ATÉ QUANDO VALE (sem data = sem prazo, usado nos testes)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS premium_ate TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.eh_premium(p_user UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user
      AND p.plano = 'premium'
      AND (p.premium_ate IS NULL OR p.premium_ate > now())
  );
$$;
REVOKE ALL ON FUNCTION public.eh_premium(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eh_premium(UUID) TO authenticated;

-- 2. ESCOLHAS DE APARÊNCIA (a pessoa grava; só vale se for Premium e o item existir)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS moldura TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS capa TEXT;
GRANT UPDATE (moldura, capa) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.profiles_aparencia_premium()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- funções do sistema (dono do banco) passam direto
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF NEW.moldura IS DISTINCT FROM OLD.moldura AND NEW.moldura IS NOT NULL THEN
    IF NOT public.eh_premium(NEW.id) THEN
      RAISE EXCEPTION 'Molduras são do Premium';
    END IF;
    IF NEW.moldura NOT IN ('dourada', 'neon', 'fogo', 'gelo', 'estadio') THEN
      RAISE EXCEPTION 'Moldura inválida';
    END IF;
  END IF;
  IF NEW.capa IS DISTINCT FROM OLD.capa AND NEW.capa IS NOT NULL THEN
    IF NOT public.eh_premium(NEW.id) THEN
      RAISE EXCEPTION 'Capas são do Premium';
    END IF;
    IF NEW.capa NOT IN ('noite', 'estadio', 'ouro', 'neon', 'campo') THEN
      RAISE EXCEPTION 'Capa inválida';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_aparencia_premium ON public.profiles;
CREATE TRIGGER profiles_aparencia_premium
BEFORE UPDATE OF moldura, capa ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_aparencia_premium();
