-- Ordem dos jogadores dentro do time. O organizador arruma a escalação na tela de times
-- (goleiro em cima, depois zaga, meio, ataque) e ela fica assim no placar, no resumo e
-- no texto que vai pro grupo. Quanto menor o número, mais em cima.
ALTER TABLE public.match_players ADD COLUMN IF NOT EXISTS ordem SMALLINT NOT NULL DEFAULT 0;
