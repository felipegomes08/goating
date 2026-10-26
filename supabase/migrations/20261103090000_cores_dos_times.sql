-- Cor do colete de cada time na pelada, escolhida pelo organizador na tela de montar os times.
-- Uma posição por time (como nomes_times), com o id da cor (ex.: 'roxo', 'vermelho'); nulo ou
-- posição vazia usa a cor padrão do time.
ALTER TABLE public.matches ADD COLUMN cores_times text[];
