-- Juntar um jogador sem conta com a conta dele também conta como presença.
--
-- Quando a conta já estava na turma (a pessoa entrou sozinha e ficou duplicada), o
-- organizador vincula e o histórico do jogador sem conta é passado pro da conta. Esse
-- caminho troca o dono das linhas do elenco, em vez de criar linhas novas ou de ligar a
-- conta ao jogador, e nenhum dos dois gatilhos de presença disparava. Resultado: a pessoa
-- aparecia no elenco e no ranking da turma, mas ficava com 0 peladas no perfil e não
-- aparecia pra ser avaliada.
--
-- Agora, trocou o jogador de uma linha do elenco, confirma a presença do novo dono.
DROP TRIGGER IF EXISTS match_players_confirma_presenca_na_troca ON public.match_players;
CREATE TRIGGER match_players_confirma_presenca_na_troca
AFTER UPDATE OF member_id ON public.match_players
FOR EACH ROW
WHEN (NEW.member_id IS DISTINCT FROM OLD.member_id)
EXECUTE FUNCTION public.match_players_confirma_presenca();

-- quem já ficou nessa situação: acerta agora (os gatilhos das presenças recalculam
-- peladas jogadas e XP)
INSERT INTO public.match_participants (match_id, user_id, status)
SELECT mp.match_id, cm.user_id, 'aprovado'
FROM public.match_players mp
JOIN public.crew_members cm ON cm.id = mp.member_id
WHERE cm.user_id IS NOT NULL
ON CONFLICT (match_id, user_id) DO UPDATE SET status = 'aprovado'
WHERE public.match_participants.status <> 'aprovado';
