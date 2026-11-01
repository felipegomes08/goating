# Ficha do Goating na App Store

Textos e respostas para preencher no App Store Connect quando a conta da Apple estiver aberta.
Tudo aqui é rascunho para o Felipe revisar. O que está marcado com **(conferir)** depende de
algo que ainda vai mudar (domínio, e-mail) ou de uma decisão dele. A descrição completa, as
capturas e as respostas de privacidade seguem a ficha da Play Store (`ficha-play-store.md`),
com as diferenças anotadas aqui.

## Identidade

| Campo | Valor |
|---|---|
| Nome (até 30 caracteres) | `Goating: peladas de futebol` |
| Subtítulo (até 30 caracteres) | `Times, placar e ranking` |
| Identificador (Bundle ID) | `br.com.goating.app` (o mesmo do Android; não muda depois) |
| SKU (código interno, ninguém vê) | `goating-ios-001` |
| Categoria principal | Esportes |
| Categoria secundária | Redes sociais |
| Idioma principal | Português (Brasil) |
| URL de suporte | `https://goating.com.br/sobre` |
| URL da política de privacidade | `https://goating.com.br/privacidade` |
| Direitos autorais | `2026 Felipe Gomes` **(conferir: nome ou empresa)** |

## Texto promocional (até 170 caracteres, muda sem nova versão)

```
Novo: ligas da turma com tabela, campeão e troféus no perfil. E o chat da turma com lista de presença e cobrança da pelada.
```

## Palavras-chave (até 100 caracteres, separadas por vírgula, sem espaço)

```
pelada,futebol,racha,sorteio,placar,artilharia,liga,futsal,society,várzea,resenha,chat
```

A Apple já usa o nome e o subtítulo na busca: não precisa repetir "goating", "times" nem "ranking"
aqui se faltar espaço.

## Descrição

Usar a descrição completa da Play Store, acrescentando antes de "SUA CARTINHA DE JOGADOR":

```
PÊNALTIS, LANCES E MVP
• Jogo empatado? Decida nos pênaltis, com placar próprio.
• Marque assistência, defesa épica e cartão amarelo, azul e vermelho.
• Depois das avaliações sai o MVP da partida, com um cartão pra compartilhar.
```

## Capturas de tela

A Apple pede imagens de iPhone de tela grande (6,9" ou 6,7"). As do Android não servem no
tamanho certo: tirar no iPhone do Felipe depois do primeiro build, na mesma ordem da ficha da
Play Store.

## Classificação etária (questionário)

- Violência, conteúdo sexual, palavrões, drogas, jogos de azar, terror: **nenhum**.
- Conteúdo gerado por usuários / interação: **sim** (comentários anônimos nas avaliações, perfis, turmas, chat da turma).
- Acesso irrestrito à internet: **não** (o app não é um navegador).

Resultado provável: **12+**, por causa do conteúdo gerado pelos usuários. A Apple exige, nesses
casos (regra 1.2), um jeito de denunciar conteúdo e de bloquear quem abusa. O Goating já atende:
"Denunciar" nos comentários e nas mensagens do chat (3 denúncias escondem), e "Bloquear" no chat.

## Privacidade do app ("rótulo de privacidade")

Rastreamento (cruzar dados com outras empresas para anúncios): **não**.

Dados coletados, todos **ligados à identidade** e **não usados para rastreamento**:

| Tipo | Item | Finalidade |
|---|---|---|
| Informações de contato | E-mail | Funcionalidade do app |
| Informações de contato | Nome | Funcionalidade do app |
| Identificadores | ID do usuário | Funcionalidade do app |
| Conteúdo do usuário | Fotos | Funcionalidade do app |
| Informações de contato | Número de telefone (opcional) | Funcionalidade do app |
| Conteúdo do usuário | Outros conteúdos (bio, cidade, posição, avaliações, comentários, peladas) | Funcionalidade do app |
| Conteúdo do usuário | Outros conteúdos do usuário: mensagens do chat da turma | Funcionalidade do app |
| Compras | Histórico de compras (assinatura Premium) | Funcionalidade do app |
| Identificadores | ID do dispositivo (token de notificação) | Funcionalidade do app |

Não coletados: localização (o "Onde estou" fica só no aparelho), contatos, histórico de navegação,
dados financeiros (o pagamento é da Apple) e de saúde.

**(conferir)** A verificação "não sou um robô" da Cloudflare: se a Apple perguntar por dados de
diagnóstico ou do dispositivo, a finalidade é "Prevenção de fraude e segurança".

## Compras dentro do app (Goating Premium)

- Assinaturas auto-renováveis num grupo `Goating Premium`: mensal (R$ 9,90) e anual (R$ 79,90),
  com oferta introdutória de R$ 0,99 no 1º mês do mensal.
- O app mostra preço, período e renovação automática antes de comprar, e tem "Restaurar compras"
  (regra 3.1.2). Termos de uso: o padrão da Apple (EULA) ou `https://goating.com.br/privacidade`.
- O dinheiro passa pelo RevenueCat, que libera o Premium no Goating.
- Antes de vender: aceitar o "Paid Apps Agreement" e preencher banco e impostos (W-8BEN) no
  App Store Connect.

## Exclusão de conta

A Apple exige que a conta possa ser excluída dentro do app: **já atende** (Perfil → Excluir minha
conta).

## Acesso para a revisão da Apple

Mesma conta de teste usada na revisão do Google (e-mail e senha próprios, criados pelo Felipe),
dentro de uma turma com uma pelada agendada e uma finalizada. Informar no campo "Informações
para revisão", com uma frase explicando o app: "Organização de peladas de futebol entre amigos:
criar pelada, sortear times, marcar placar e avaliar os jogadores."

## O que só dá pra fazer depois de pagar a Apple (US$ 99/ano)

1. Criar o app no App Store Connect com o Bundle ID `br.com.goating.app`.
2. Gerar os certificados e montar o app num serviço na nuvem (não há Mac): sugestão Codemagic,
   que tem plano gratuito para começar.
3. Instalar no iPhone do Felipe pelo TestFlight e fazer a rodada de ajustes. Pontos a conferir:
   - margens com o entalhe e a barra de gestos (configurado, nunca visto num iPhone);
   - o "não sou um robô" da Cloudflare dentro do app (no iPhone o endereço interno do app é
     diferente do Android);
   - compartilhar imagem e texto, câmera, galeria e o "Onde estou".
4. Tirar as capturas, enviar para revisão.
