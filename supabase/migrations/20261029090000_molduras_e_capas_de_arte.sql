-- Molduras e capas de arte: entram as molduras Cristais, Furacão e Tempestade e as capas
-- Coletiva e Galáxia (Inferno e Era do Gelo usam os ids "fogo" e "gelo"; Estádio continua
-- "estadio"). A lista é a mesma de src/lib/molduras.ts e src/lib/capas.ts.
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
    IF NEW.moldura NOT IN (
      'dourada', 'neon', 'fogo', 'gelo', 'estadio', 'cristais', 'furacao', 'tempestade'
    ) THEN
      RAISE EXCEPTION 'Moldura inválida';
    END IF;
  END IF;
  IF NEW.capa IS DISTINCT FROM OLD.capa AND NEW.capa IS NOT NULL THEN
    IF NOT public.eh_premium(NEW.id) THEN
      RAISE EXCEPTION 'Capas são do Premium';
    END IF;
    IF NEW.capa NOT IN ('noite', 'estadio', 'ouro', 'neon', 'campo', 'coletiva', 'galaxia') THEN
      RAISE EXCEPTION 'Capa inválida';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
