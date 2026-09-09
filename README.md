# Goating

Crie o **Goating** — uma rede social de futebol amador (peladas) que conecta organizadores e jogadores por cidade. É um misto de LinkedIn (perfil, conexões) e Instagram (feed) focado em futebol, com gamificação estilo FIFA/PES.

Comece construindo a base técnica sólida do MVP (schema Supabase + auth + as 3 telas principais). Priorize estrutura correta sobre velocidade.

---

# 1. CONCEITO

Plataforma **web responsiva, mobile-first**. Três pilares (tagline oficial): **"Jogue. Conecte. Evolua."**
- **Jogue**: entrar em peladas da sua cidade
- **Conecte**: seguir jogadores da região
- **Evolua**: subir de tier no card do jogador via avaliações dos colegas

Nome "Goating" = gíria de "mitando/dominando", derivada de GOAT (Greatest Of All Time). Referências de vibe: **Cartola FC** (divertido, brasileiro, gamificado) + **OneFootball** (limpo, acabamento profissional). Tom: divertido mas bem executado — nunca amador. Todo o texto da interface em **português do Brasil**.

---

# 2. IDENTIDADE VISUAL (obrigatória)

## Paleta
- **Verde Floresta `#0F3D2E`** — cor primária, fundos de header/nav, botões primários
- **Verde Menta `#7FE0A0`** — cor de destaque/acento, texto sobre verde escuro, CTAs de ação
- Neutros: Preto `#1B1B1B`, Cinza `#6B6B6B`, Cinza claro `#F2F2F2` (fundo de tela)

Configure isso como design tokens no `tailwind.config` e nas CSS variables do shadcn (não hardcode hex espalhado pelos componentes).

## Tipografia
**Poppins** (Google Fonts), pesos 400/500/600/700/800. Sem exceções.

## Estilo
Flat/vetorial. Cards brancos com `border-radius` generoso (14–16px) e sombra suave. Ícones de linha (lucide-react). **Sem gradientes agressivos, sem emoji, sem sombras pesadas.**

## Logo
O símbolo é: chifres de bode estilizados abstratos abraçando a letra "G", com um detalhe de "barba" na base e uma folha integrada (crescimento/evolução). Por ora, use um placeholder simples: quadrado arredondado verde menta com "G" em Poppins ExtraBold verde floresta. Eu subo os arquivos finais do logo depois.

Usos incorretos a evitar: não alterar cores da marca, não distorcer o símbolo, não remover elementos, não adicionar efeitos fora do estilo flat.

---

# 3. STACK

- Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui
- Backend: **Supabase** — Postgres, Auth, Storage (fotos de perfil e cards gerados), Edge Functions
- Stripe: **fora do MVP** (só o campo `plano` existe desde já)

---

# 4. MODELAGEM DE DADOS (Supabase)

Crie as tabelas com RLS habilitado e políticas coerentes.

## `users` (perfil do jogador)
`id`, `nome_exibicao` (obrigatório), `email` (ou nick), `foto_url`, `bio`, `cidade`, `posicao_preferida`, `overall` (calculado, escala 0–100), `peladas_jogadas` (contador), `plano` (`free` | `premium`, default `free`), `perfil_completo` (boolean), `card_gerado_url`, `criado_em`

## `matches` (peladas)
`id`, `organizador_id` → users, `titulo`, `descricao`, `data`, `horario`, `local`, `cidade`, `quantidade_vagas`, `tipo` (`aberta` | `fechada`), `status` (`agendada` | `em_andamento` | `finalizada` | `cancelada`), `criado_em`

## `match_invite_links`
`id`, `match_id` → matches, `token` (único), `ativo` (boolean), `criado_em`

Regras: link é único **por pelada** (não por convidado). Entrar pelo link é **aprovação implícita**, mesmo em pelada fechada. O link para de funcionar automaticamente quando as vagas esgotam, e o organizador pode revogá-lo manualmente (gerando um novo).

## `match_participants`
`id`, `match_id` → matches, `user_id` → users, `status` (`pendente` | `aprovado` | `recusado`), `entrou_em`

Peladas abertas e entradas via link já entram como `aprovado`. Só solicitação manual em pelada fechada fica `pendente`.

## `evaluations` (avaliações pós-pelada)
`id`, `match_id`, `avaliador_id` → users, `avaliado_id` → users, `nota_geral` (0–10), e atributos opcionais (0–10 cada): `chute`, `drible`, `velocidade`, `toque`, `posicionamento`, `comportamento`, `pontualidade`, `criado_em`

Regras: só pode existir avaliação entre usuários que participaram (status `aprovado`) da mesma `match` já `finalizada`. **Aplique isso via RLS/constraint, não só no frontend.**

## `card_tiers` (tabela de configuração)
`id`, `nome`, `overall_minimo`, `peladas_minimas`, `ordem`. Seed com:

| Tier | Overall mínimo | Peladas mínimas |
|---|---|---|
| Bronze | 0 | 5 |
| Prata | 60 | 8 |
| Ouro | 70 | 25 |
| Platina | 80 | 50 |
| Lendário | 90 | 100 |
| GOAT | 95 | 180 |

O tier é **derivado** (calculado comparando `overall` e `peladas_jogadas` do usuário com esta tabela), nunca um campo fixo no perfil. **Ambos** os critérios precisam ser atingidos simultaneamente — isso evita que uma boa avaliação pontual sem histórico real "salte" o jogador vários tiers.

## `followers`
`id`, `seguidor_id` → users, `seguido_id` → users, `criado_em`

Escopo atual: buscar jogador por nome, seguir, e ver uma aba com o rank (overall) dos jogadores seguidos. Sem feed de atividades por agora.

---

# 5. REGRAS DE NEGÓCIO CRÍTICAS

## ⚠️ Duas escalas diferentes — não confunda
- **Quem avalia usa 0 a 10** (nota geral e cada atributo detalhado) — rápido e natural de preencher. A tabela `evaluations` guarda 0–10.
- **O overall e os atributos exibidos no card/perfil usam 0 a 100** (média × 10), pra bater com o padrão FIFA/PES (ex: overall 92, CHUTE 91). A conversão acontece só no cálculo/exibição — a tabela de avaliações não muda.

## Overall
Recalculado **em tempo real** a cada nova avaliação recebida (média das notas gerais → convertida para 0–100). Só é **exibido publicamente após um mínimo de avaliações (use 3)** — antes disso, o card e os atributos aparecem em estado **"bloqueado/aguardando avaliações"**, com uma mensagem tipo "Faltam 2 avaliações pós-pelada para liberar seu overall e tier".

## Localização
Filtro do feed por **cidade** (campo de texto direto em `users` e `matches`), **sem** cálculo geográfico por coordenadas ou raio.

## MVP da partida
- Prazo de avaliação: **24h** após o término da pelada. Depois disso as avaliações fecham e o MVP é calculado.
- MVP = melhor média de `nota_geral` entre os participantes daquela partida.
- Desempate: quem recebeu **mais avaliações** naquela partida.
- O selo fica no histórico da pelada e soma um contador no perfil ("5 vezes MVP").

## Card do jogador — renderização com cache de imagem
O card visual (molde do tier + foto + nome + overall + atributos) é **pré-renderizado e salvo como imagem** no Supabase Storage, em vez de montado dinamicamente a cada visualização — evita reprocessamento quando alguém navega rápido por vários perfis.

- Campo `users.card_gerado_url` aponta pra imagem final composta.
- Tenho **6 moldes PNG prontos** (um por tier: Bronze, Prata, Ouro, Platina, Lendário, GOAT), todos do mesmo tamanho (1086×1448), sem nome/números, com o espaço da foto **recortado e transparente** em formato de escudo, e espaços reservados vazios para nome, overall+posição e os números dos atributos. **Vou subir esses PNGs no Storage — deixe o código lendo eles de um bucket, não gere moldes em CSS/SVG.**
- Regeneração **assíncrona** via edge function (atraso de segundos/minutos é aceitável): dispara quando uma nova avaliação muda o que o card exibe, quando o tier muda, quando as peladas jogadas destravam um tier novo, ou quando o usuário troca a foto. Enquanto a nova versão não fica pronta, **a versão anterior continua sendo exibida** — nunca trave a tela.
- Composição: a foto do jogador entra **atrás** do molde (o recorte transparente do PNG faz a máscara naturalmente), preservando a proporção original da foto sem esticar.

## Cadastro rápido via link de convite
1. Organizador cria a pelada e gera o link
2. Compartilha (ex: WhatsApp)
3. Quem recebe: se já tem conta, confirma presença e entra como `aprovado`; se não tem, faz cadastro rápido (**só nome de exibição, email/nick e senha**) e já entra vinculado à pelada
4. **Cidade não é pedida no cadastro rápido** — o feed fica bloqueado com uma chamada ("complete seu cadastro para ver as peladas perto de você") até o perfil ser completado
5. O link morre quando as vagas esgotam ou quando o organizador revoga

---

# 6. ESCOPO DO MVP

**Dentro:** cadastro/login (email ou nick + senha) · cadastro rápido via convite · perfil básico (foto, bio, posição, cidade) · criação de pelada (aberta/fechada) · feed por cidade · entrar/solicitar entrada · aprovação manual do organizador · avaliação pós-pelada (nota geral + atributos) · overall automático · card visual com tier · seguir jogadores · MVP da partida

**Fora (fases futuras):** cobrança/limitação premium via Stripe · sistema de conquistas/troféus · feed de conquistas dos seguidos · app mobile nativo

---

# 7. TELAS PARA CONSTRUIR AGORA

Já prototipei estas três. Construa nesta ordem, seguindo as especificações abaixo.

## 7.1 FEED (tela principal)

Layout mobile-first, container centralizado com `max-width` ~480px em telas grandes, altura total da viewport, header fixo + área rolável + nav inferior fixa.

- **Header** verde floresta: logo (quadrado menta com "G") + wordmark "Goating" à esquerda, ícone de notificações (sino) à direita. Abaixo, uma linha discreta com ícone de pin + a cidade do usuário como **texto simples não clicável** (ex: "Patos de Minas, MG").
- ⚠️ **Importante: NÃO coloque um seletor de cidade clicável no feed.** A tela precisa ser limpa e focada no conteúdo, estilo Instagram — e um seletor exposto aqui incentivaria as pessoas a trocar de cidade e entrar em peladas de outras regiões só pra zoar. A troca de cidade ("modo viagem") vai existir, mas dentro de perfil/configurações, não aqui.
- **Título da lista**: "Peladas em {cidade}" + contagem à direita ("4 peladas").
- **Card de pelada** (branco, radius 16, sombra suave), contendo:
  - Badge de tipo no canto superior direito — **a diferença precisa ser visualmente óbvia**: `ABERTA` = fundo menta claro `#DFF6E8`, borda menta, ícone de check, texto verde floresta. `FECHADA` = fundo cinza claro, borda cinza, ícone de cadeado, texto cinza.
  - Título da pelada
  - Linha do organizador: avatar circular com iniciais + "por **Nome**" + chip do tier do organizador (cor por tier)
  - Bloco com separadores: ícone de calendário + "Qui, 28 ago · 19:30"; ícone de pin + "Arena Gol Society · Patos de Minas, MG"
  - Vagas: "8/10 confirmados" + barra de progresso — a barra comunica o quão perto está de lotar (verde floresta normal, menta quando passa de 70%, vermelho `#B04B4B` + label "LOTADO" quando cheia)
  - Botão de ação de largura total: **"Entrar"** (menta, texto verde floresta) em pelada aberta; **"Solicitar entrada"** (verde floresta, texto branco) em pelada fechada; **"Lotado"** desabilitado em cinza quando cheia
- **Estado vazio**: quando não há peladas na cidade, mostrar círculo com ícone de bola, "Nenhuma pelada por aqui ainda", uma linha amigável ("Seja o primeiro a organizar uma pelada em {cidade} e reúna a galera pra jogar.") e um botão "Criar pelada em {cidade}".
- **Nav inferior** (3 itens): Feed (ícone casa) · **Criar** (botão central destacado: círculo verde floresta de 52px elevado acima da barra com borda de 4px na cor do fundo, ícone "+" menta) · Perfil (ícone pessoa). Item ativo em verde floresta, inativos em cinza.

## 7.2 CRIAR PELADA

Formulário rápido — o usuário precisa conseguir criar uma pelada em **menos de 1 minuto**. Boa hierarquia visual, nada burocrático. Header verde floresta com seta de voltar + "Criar Pelada".

Campos: **Título** (texto curto) · **Data** e **Horário** lado a lado · **Local** (endereço do campo/quadra) · **Cidade** (com hint "Usada para mostrar essa pelada no feed de quem está nessa cidade") · **Quantidade de vagas** (stepper +/−, min 2, max 30, default 10)

**Tipo de pelada**: dois cartões grandes lado a lado, selecionáveis, cada um com título, ícone e **uma descrição curta embaixo explicando a diferença** — o usuário precisa entender o que está escolhendo:
- **Aberta** — "Qualquer jogador entra direto até lotar as vagas." (selecionado: fundo menta claro, borda menta)
- **Fechada** — "Jogador solicita entrada e o organizador aprova manualmente." (selecionado: fundo verde floresta, texto branco)

Botão fixo no rodapé: **"Criar Pelada"** (menta quando o formulário está válido, cinza desabilitado quando não).

⚠️ **Não coloque campo nem botão de "gerar link de convite" neste formulário.** O link aparece **depois**, na tela de sucesso.

**Tela de sucesso** (após criar): círculo verde floresta com check menta, "Pelada criada!", uma linha com o título e a cidade, uma caixa com borda tracejada menta mostrando o link (`goating.app/p/{slug}`), botão "Compartilhar link" (verde floresta) e botão secundário "Ver no feed" (contorno).

## 7.3 PERFIL DO JOGADOR

Esta é a tela mais importante para retenção — precisa dar orgulho de abrir. Header verde floresta com seta de voltar, "Meu Perfil" e ícone de engrenagem.

Estrutura, de cima pra baixo:
1. **Faixa de identidade** (fundo verde floresta, continuando o header): foto circular com borda menta, nome em ExtraBold, linha "@handle · Cidade", chips de posição (menta) e tier (translúcido)
2. **Bio** curta + botões "Editar perfil" (contorno) e um botão quadrado de compartilhar. Em perfil de outro jogador, "Editar perfil" vira **"Seguir"** (verde floresta preenchido).
3. **Card do jogador** em destaque — o molde PNG do tier com a foto atrás do recorte de escudo, e sobrepostos: overall + posição no hexágono superior esquerdo, nome na faixa abaixo do escudo, e os 5 números de atributos nas colunas da parte inferior. **Cada tier tem sua própria cor de texto** (bronze/cobre, prata, dourado, verde-gelo platina, branco lendário, azul GOAT) e um leve ajuste de posicionamento vertical — deixe isso configurável por tier, não hardcoded numa única posição.
4. **"Próxima cartinha"** — progresso pro tier seguinte: overall atual grande, "/{limiar} para {próximo tier}", barra de progresso com gradiente verde floresta → menta, e uma linha de dica ("Faltam 4 pontos de overall...").
5. **"Números da temporada"** — grid 3×2 de estatísticas: peladas jogadas, avaliações recebidas, vezes MVP, média das notas, presença confirmada, sequência atual.
6. **"Teia de atributos"** — gráfico radar/teia estilo FIFA antigo, em card de fundo verde floresta: 7 eixos (chute, drible, velocidade, toque, posicionamento, comportamento, pontualidade), anéis concêntricos discretos, polígono preenchido em menta translúcido com borda menta sólida, pontos nos vértices, e label + número em cada eixo.
7. **"Atributos detalhados"** — os 7 atributos em barras horizontais com o número (0–100) à direita.
8. **"Últimas peladas"** — lista das últimas 4: título, data + resultado, badge MVP quando aplicável, e a nota recebida naquela partida.
9. **Estado bloqueado**: se o jogador ainda não atingiu o mínimo de 3 avaliações, o card, o overall e os atributos aparecem **cobertos por um overlay bloqueado** com ícone de cadeado e a mensagem de quantas avaliações faltam.

---

Comece pelo schema Supabase + auth, depois o Feed, Criar Pelada e Perfil. Em seguida me diga o que ficou pronto e o que falta (avaliação pós-pelada, seguir jogadores, edge function de geração do card) para eu priorizar os próximos passos.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://goating.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a50299b2-6fe6-4967-8951-d88efabc7552).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
