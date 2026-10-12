# Ficha do Goating na Play Store

Textos e respostas para preencher no Google Play Console quando a conta estiver aberta.
Tudo aqui é rascunho para o Felipe revisar. O que está marcado com **(conferir)** depende de
algo que ainda vai mudar (domínio, e-mail) ou de uma decisão dele.

## Identidade

| Campo | Valor |
|---|---|
| Nome do app (até 30 caracteres) | `Goating: peladas de futebol` |
| Identificador do app | `br.com.goating.app` (não pode mudar depois de publicar) |
| Categoria | Esportes |
| Idioma padrão | Português (Brasil) |
| E-mail de contato | **(conferir)** hoje `felipecgomes02@gmail.com`; trocar pelo do Goating quando existir |
| Site | **(conferir)** `https://goating-kappa.vercel.app`; trocar por `https://goating.com.br` |
| Política de privacidade | `https://goating-kappa.vercel.app/privacidade` **(conferir domínio)** |

## Descrição curta (até 80 caracteres)

```
Organize a pelada, sorteie os times, marque o placar e suba no ranking da turma.
```

Alternativas:

```
Sua pelada organizada: times sorteados, placar ao vivo e ranking da turma.
```

```
A pelada da sua turma com sorteio de times, placar, artilharia e cartinha.
```

## Descrição completa (até 4.000 caracteres)

```
O Goating é o app da pelada. Ele cuida da parte chata de organizar o futebol com os amigos e deixa a parte boa mais divertida: placar, artilharia, ranking e uma cartinha de jogador que evolui a cada jogo.

ORGANIZE SEM DOR DE CABEÇA
• Crie a pelada em menos de um minuto: dia, horário, local e vagas.
• Marque o campo no mapa. Quem for jogar toca no local e já sai com a rota no Maps ou no Waze.
• Pelada toda semana? Crie uma vez e ela se repete sozinha.
• Chame a galera por um link. Dá para confirmar presença sem nem ter conta.

TIMES EQUILIBRADOS EM SEGUNDOS
• Cole a lista do WhatsApp e o Goating reconhece os nomes.
• Sorteie os times equilibrando por posição e nível de cada jogador.
• Não gostou? Sorteie de novo ou arraste os jogadores de um time para o outro.
• Compartilhe os times prontos no grupo.

PLACAR AO VIVO
• Cronômetro com alarme e vibração no fim do tempo.
• Marque quem fez cada gol com um toque.
• Jogo único ou rachão com vários times: quem ganha fica.
• A tela não apaga enquanto a bola rola.

A RESENHA DEPOIS DO JOGO
• Pôster do resultado pronto para mandar no grupo, com a foto do time.
• Artilharia do dia e classificação dos times.
• Ranking da turma por mês, por ano ou de todos os tempos: jogos, vitórias, gols e aproveitamento.

SUA CARTINHA DE JOGADOR
• Depois de cada pelada, quem jogou avalia quem jogou. As notas são anônimas.
• Chute, drible, velocidade, toque, posicionamento: seus atributos aparecem na sua carta.
• Suba de nível, do Bronze ao GOAT, jogando e sendo bem avaliado.
• Compartilhe sua carta e mostre quem manda na pelada.

SUA TURMA, DO SEU JEITO
• Crie a turma do seu futebol, com escudo e foto de capa.
• Escolha administradores para ajudar a organizar.
• Jogador sem conta também entra na lista e no ranking; quando ele criar a conta, o histórico vai junto.

O Goating é gratuito e não tem anúncios.
```

## Capturas de tela (mínimo 2, recomendado 6 a 8)

Tiradas no celular, em pé. Sugestão de ordem e do texto que acompanha cada uma:

1. **Feed com a próxima pelada**: "Sua pelada da semana, sempre à mão"
2. **Sorteio dos times**: "Times equilibrados em segundos"
3. **Placar com cronômetro**: "Placar ao vivo, com alarme no fim do tempo"
4. **Pôster do resultado**: "O resultado pronto pra mandar no grupo"
5. **Ranking da turma**: "Quem é o artilheiro da turma?"
6. **Perfil com a cartinha**: "Sua carta de jogador evolui a cada pelada"
7. **Página da turma com capa e escudo**: "A turma com a cara do seu futebol"
8. **Detalhe da pelada com o mapa**: "Toque no local e saia com a rota"

Além das capturas, a loja pede:
- **Ícone de 512 x 512**: sai de `assets/icon-only.png`.
- **Imagem de destaque de 1024 x 500**: ainda não existe; fazer com a logo e o verde do app.

## Classificação de conteúdo (questionário)

Respostas esperadas:
- Violência, sexo, linguagem imprópria, drogas, jogos de azar: **não**.
- O app permite interação entre usuários: **sim** (perfis visíveis, seguir jogadores, avaliações).
- Usuários compartilham conteúdo que outros veem: **sim** (nome, foto de perfil, bio, escudo e capa da turma).
- Compartilha a localização do usuário com outros: **não**.
- Compras dentro do app: **não**.

Resultado provável: Livre ou 10+, por causa da interação entre usuários.

## Público-alvo

- Faixa etária: **18 anos ou mais** **(conferir)**. Declarar menores de 13 obriga a seguir regras extras para crianças; declarar só adultos é o caminho mais simples.
- O app não é direcionado a crianças.

## Segurança dos dados (formulário "Data safety")

**O app coleta ou compartilha dados do usuário?** Sim, coleta. Não compartilha com terceiros (empresas de infraestrutura que só processam os dados em nome do Goating não contam como compartilhamento).

**Os dados são criptografados em trânsito?** Sim.

**O usuário pode pedir a exclusão dos dados?** Sim, pelo próprio app.

| Dado | Coletado | Obrigatório | Para quê |
|---|---|---|---|
| E-mail | Sim | Sim | Gerenciamento da conta |
| Nome | Sim | Sim | Funcionamento do app |
| Identificador do usuário (nick) | Sim | Sim | Funcionamento do app |
| Fotos (perfil, escudo e capa da turma) | Sim | Não | Funcionamento do app |
| Outros conteúdos do usuário (bio, avaliações, peladas, gols) | Sim | Não | Funcionamento do app |
| Interações no app | Não | | |
| Localização | Não | | O "Onde estou" usa a posição só no aparelho, para centralizar o mapa |
| Contatos, mensagens, áudio, arquivos | Não | | |
| Dados financeiros, de saúde | Não | | |

**(conferir)** A verificação "não sou um robô" da Cloudflare analisa sinais do navegador para barrar robôs. Na hora de preencher, vale ler a opção "Identificadores do dispositivo ou outros" e marcar se a descrição do Google encaixar; a finalidade seria "Prevenção de fraude e segurança".

## Exclusão de conta (campo obrigatório)

O Google pede um endereço na internet onde a pessoa consegue pedir a exclusão da conta sem precisar do app.

- Endereço: `https://goating-kappa.vercel.app/privacidade` **(conferir domínio)**
- A página explica o caminho: entrar na conta, abrir **Perfil** e tocar em **Excluir minha conta**. Como o Goating também funciona pelo navegador, dá para fazer tudo pelo site.
- O que é apagado: perfil, foto, avaliações e seguidores. Gols e vitórias continuam no ranking da turma só com o nome, sem ligação com a pessoa.

## Acesso para a revisão do Google

O app exige login, então o Google pede uma conta de teste para os revisores.

- **(a fazer pelo Felipe)** Criar uma conta só para isso, com e-mail e senha próprios, e informar os dois no campo "Acesso ao app". Não usar a conta pessoal.
- Deixar essa conta dentro de uma turma com uma pelada agendada e uma finalizada, para o revisor ver as telas principais.

## Teste fechado (exigência para conta nova)

- 12 testadores, por 14 dias seguidos, antes de poder pedir produção.
- Cada testador precisa de uma conta Google e de aceitar o convite pelo link do teste.
- A lista de e-mails dos testadores é cadastrada no Play Console.
